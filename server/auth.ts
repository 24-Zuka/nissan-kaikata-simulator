import { createHmac, timingSafeEqual } from 'node:crypto'
import { createClerkClient } from '@clerk/backend'
import type { ApiRequest, ApiResponse } from './http.js'

export const AUTH_COOKIE_NAME = 'npc_session'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 400

export type AuthenticatedActor = {
  userId: string
  organizationId: string
  role: 'admin' | 'member'
  displayName: string
  authMode: 'clerk' | 'legacy'
}

function getSecret(): string {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 32) throw new Error('auth-not-configured')
  return secret
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url')
}

export function createSessionToken(): string {
  const payload = Buffer.from(
    JSON.stringify({ version: 1, issuedAt: Date.now() }),
  ).toString('base64url')
  return `${payload}.${sign(payload)}`
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false
  const [payload, signature, extra] = token.split('.')
  if (!payload || !signature || extra) return false
  const expected = Buffer.from(sign(payload))
  const received = Buffer.from(signature)
  if (expected.length !== received.length) return false
  if (!timingSafeEqual(expected, received)) return false
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString()) as {
      version?: unknown
      issuedAt?: unknown
    }
    return decoded.version === 1
      && typeof decoded.issuedAt === 'number'
      && decoded.issuedAt <= Date.now()
      && Date.now() - decoded.issuedAt <= COOKIE_MAX_AGE * 1000
  } catch {
    return false
  }
}

export function verifyPassword(password: string): boolean {
  const configured = process.env.APP_PASSWORD
  if (!configured) return false
  const expected = Buffer.from(configured)
  const received = Buffer.from(password)
  return expected.length === received.length && timingSafeEqual(expected, received)
}

function readCookie(request: ApiRequest, name: string): string | undefined {
  const header = request.headers.cookie
  if (!header) return undefined
  for (const part of header.split(';')) {
    const [key, ...value] = part.trim().split('=')
    if (key === name) return decodeURIComponent(value.join('='))
  }
  return undefined
}

export function setSessionCookie(
  response: ApiResponse,
  token: string,
): void {
  const secure = process.env.VERCEL === '1' ? '; Secure' : ''
  response.setHeader(
    'Set-Cookie',
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${COOKIE_MAX_AGE}${secure}`,
  )
}

export function clearSessionCookie(response: ApiResponse): void {
  const secure = process.env.VERCEL === '1' ? '; Secure' : ''
  response.setHeader(
    'Set-Cookie',
    `${AUTH_COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`,
  )
}

export function requireAuthentication(
  request: ApiRequest,
  response: ApiResponse,
): boolean {
  const token = readCookie(request, AUTH_COOKIE_NAME)
  if (!verifySessionToken(token)) {
    response.status(401).json({ message: 'ログインが必要です。' })
    return false
  }
  // Renew the signed token as well as the cookie expiry so active sessions slide.
  setSessionCookie(response, createSessionToken())
  return true
}

function requestUrl(request: ApiRequest): string {
  const forwardedProto = request.headers['x-forwarded-proto']
  const protocol = Array.isArray(forwardedProto)
    ? forwardedProto[0]
    : forwardedProto || (process.env.VERCEL === '1' ? 'https' : 'http')
  const forwardedHost = request.headers['x-forwarded-host']
  const host = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : forwardedHost || request.headers.host || 'localhost'
  return `${protocol}://${host}${request.url || '/'}`
}

function webRequest(request: ApiRequest): Request {
  const headers = new Headers()
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) value.forEach((item) => headers.append(key, item))
    else if (value !== undefined) headers.set(key, value)
  }
  return new Request(requestUrl(request), { method: request.method, headers })
}

export async function authenticateActor(
  request: ApiRequest,
  response: ApiResponse,
): Promise<AuthenticatedActor | null> {
  const secretKey = process.env.CLERK_SECRET_KEY
  const publishableKey =
    process.env.CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  if (secretKey && publishableKey) {
    const client = createClerkClient({ secretKey, publishableKey })
    const host = new URL(requestUrl(request)).origin
    const authorizedParties = (process.env.CLERK_AUTHORIZED_PARTIES || host)
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
    const state = await client.authenticateRequest(webRequest(request), {
      acceptsToken: 'session_token',
      authorizedParties,
    })
    if (!state.isAuthenticated) {
      response.status(401).json({ message: 'ログインが必要です。' })
      return null
    }
    const auth = state.toAuth()
    if (!auth.userId || !auth.orgId) {
      response.status(403).json({ message: '店舗組織への参加が必要です。' })
      return null
    }
    return {
      userId: auth.userId,
      organizationId: auth.orgId,
      role: auth.orgRole === 'org:admin' ? 'admin' : 'member',
      displayName: auth.userId,
      authMode: 'clerk',
    }
  }

  if (!requireAuthentication(request, response)) return null
  return {
    userId: 'legacy-admin',
    organizationId: process.env.CLERK_DEFAULT_ORGANIZATION_ID || 'legacy-organization',
    role: 'admin',
    displayName: '従来管理者',
    authMode: 'legacy',
  }
}

export function isSameOrigin(request: ApiRequest): boolean {
  const origin = request.headers.origin
  const forwardedHost = request.headers['x-forwarded-host']
  const host = Array.isArray(forwardedHost)
    ? forwardedHost[0]
    : forwardedHost || request.headers.host
  if (!origin || !host) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export function clientIp(request: ApiRequest): string {
  const forwarded = request.headers['x-forwarded-for']
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded
  return value?.split(',')[0]?.trim() || request.socket.remoteAddress || 'unknown'
}

export function noStore(response: ApiResponse): void {
  response.setHeader('Cache-Control', 'no-store, private')
}
