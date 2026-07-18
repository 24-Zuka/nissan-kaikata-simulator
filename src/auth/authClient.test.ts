import { beforeEach, describe, expect, it } from 'vitest'
import {
  AUTH_STORAGE_KEY,
  clearAuthMarker,
  hasAuthMarker,
  setAuthMarker,
} from './authClient'

describe('auth marker', () => {
  beforeEach(() => localStorage.clear())

  it('persists only a non-sensitive authenticated marker', () => {
    setAuthMarker()
    expect(hasAuthMarker()).toBe(true)
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBe('authenticated')

    clearAuthMarker()
    expect(hasAuthMarker()).toBe(false)
  })
})
