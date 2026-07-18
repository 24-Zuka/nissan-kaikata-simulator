import type { ApiRequest, ApiResponse } from '../../server/http.js'
import {
  clientIp,
  createSessionToken,
  isSameOrigin,
  noStore,
  setSessionCookie,
  verifyPassword,
} from '../../server/auth.js'
import {
  clearLoginAttempts,
  consumeLoginAttempt,
} from '../../server/cloudStore.js'

export default async function handler(
  request: ApiRequest,
  response: ApiResponse,
) {
  noStore(response)
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    return response.status(405).json({ message: '許可されていない操作です。' })
  }
  if (!isSameOrigin(request)) {
    return response.status(403).json({ message: 'アクセス元を確認できません。' })
  }

  try {
    const ip = clientIp(request)
    if (!(await consumeLoginAttempt(ip))) {
      return response.status(429).json({ message: 'パスワードが違います' })
    }
    const password =
      typeof request.body?.password === 'string' ? request.body.password : ''
    if (!verifyPassword(password)) {
      return response.status(401).json({ message: 'パスワードが違います' })
    }

    await clearLoginAttempts(ip)
    setSessionCookie(response, createSessionToken())
    return response.status(200).json({ authenticated: true })
  } catch {
    return response.status(503).json({ message: 'ログイン機能を利用できません。' })
  }
}
