import type { ThemePreference } from '../theme/theme'

type Props = {
  value: ThemePreference
  onChange: (theme: ThemePreference) => void
}

export function ThemeToggle({ value, onChange }: Props) {
  const dark = value === 'dark'

  return (
    <button
      aria-checked={dark}
      aria-label={`ダークテーマ ${dark ? 'オン' : 'オフ'}`}
      className="theme-toggle"
      onClick={() => onChange(dark ? 'light' : 'dark')}
      role="switch"
      type="button"
    >
      <span className="theme-toggle__track" aria-hidden="true">
        <span />
      </span>
      <span>ダーク</span>
    </button>
  )
}
