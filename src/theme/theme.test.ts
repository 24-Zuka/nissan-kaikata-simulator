import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyTheme,
  getInitialTheme,
  getSystemTheme,
  saveTheme,
  THEME_STORAGE_KEY,
} from './theme'

describe('theme preference', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    document.documentElement.removeAttribute('style')
    document.head.innerHTML = '<meta name="theme-color" content="#F5F5F7">'
  })

  it('保存値がなければOSのダーク設定を使用する', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList)

    expect(getSystemTheme()).toBe('dark')
    expect(getInitialTheme()).toBe('dark')
  })

  it('保存済みの手動設定をOS設定より優先する', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList)
    window.localStorage.setItem(THEME_STORAGE_KEY, 'light')

    expect(getInitialTheme()).toBe('light')
  })

  it('テーマとtheme-colorを同期して保存する', () => {
    saveTheme('dark')

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      'content',
      '#000000',
    )

    applyTheme('light')
    expect(document.querySelector('meta[name="theme-color"]')).toHaveAttribute(
      'content',
      '#F5F5F7',
    )
  })
})
