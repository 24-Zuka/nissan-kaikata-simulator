export type ThemePreference = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'nissan-comparison-theme'

const THEME_COLORS: Record<ThemePreference, string> = {
  light: '#F5F5F7',
  dark: '#000000',
}

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'light' || value === 'dark'
}

export function getSystemTheme(): ThemePreference {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function getInitialTheme(): ThemePreference {
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY)
  return isThemePreference(saved) ? saved : getSystemTheme()
}

export function applyTheme(theme: ThemePreference): void {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  document
    .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute('content', THEME_COLORS[theme])
}

export function saveTheme(theme: ThemePreference): void {
  window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  applyTheme(theme)
}
