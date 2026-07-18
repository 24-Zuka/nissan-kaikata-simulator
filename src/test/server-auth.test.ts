import { afterEach, describe, expect, it } from 'vitest'
import {
  createSessionToken,
  verifyPassword,
  verifySessionToken,
} from '../../server/auth'

describe('server auth token', () => {
  afterEach(() => {
    delete process.env.AUTH_SECRET
    delete process.env.APP_PASSWORD
  })

  it('accepts signed sessions and rejects modified tokens', () => {
    process.env.AUTH_SECRET = [
      'test-only',
      'secret-value',
      'with-more-than-32-characters',
    ].join('-')
    const token = createSessionToken()

    expect(verifySessionToken(token)).toBe(true)
    expect(verifySessionToken(`${token}modified`)).toBe(false)
  })

  it('compares the configured password without embedding it in browser code', () => {
    process.env.APP_PASSWORD = ['test', 'password'].join('-')

    expect(verifyPassword(['test', 'password'].join('-'))).toBe(true)
    expect(verifyPassword('wrong')).toBe(false)
  })
})
