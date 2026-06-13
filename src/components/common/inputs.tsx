/**
 * 入力プリミティブ。
 * - YenInput: 金額入力（数字のみ）。optional=true で未入力('')を許容。
 * - 表示は右揃え・tabular-nums。未入力時にNaNを出さない。
 */

import { useEffect, useRef, useState } from 'react'

type YenInputProps = {
  id?: string
  label: string
  value: number | ''
  onChange: (v: number) => void
  /** 未入力許容（'' を扱う）。 */
  optional?: boolean
  /** optional時の未入力コールバック。 */
  onChangeOptional?: (v: number | '') => void
  placeholder?: string
  hint?: string
  suffix?: string
}

/** 数字以外を除去して整数化（負数は0）。 */
function sanitize(raw: string): string {
  return raw.replace(/[^\d]/g, '')
}

export function YenInput({
  id,
  label,
  value,
  onChange,
  optional,
  onChangeOptional,
  placeholder,
  hint,
  suffix = '円',
}: YenInputProps) {
  const [buffer, setBuffer] = useState<string>(value === '' ? '' : String(value))
  const focused = useRef(false)

  // 外部から値が変わった場合、フォーカスしていなければバッファを同期。
  useEffect(() => {
    if (!focused.current) {
      setBuffer(value === '' ? '' : String(value))
    }
  }, [value])

  const handleChange = (raw: string) => {
    const cleaned = sanitize(raw)
    setBuffer(cleaned)
    if (cleaned === '') {
      if (optional && onChangeOptional) onChangeOptional('')
      else onChange(0)
    } else {
      const n = Number(cleaned)
      const safe = Number.isFinite(n) ? n : 0
      if (optional && onChangeOptional) onChangeOptional(safe)
      else onChange(safe)
    }
  }

  return (
    <label className="field" htmlFor={id}>
      <span className="field__label">{label}</span>
      <span className="field__inputwrap">
        <input
          id={id}
          className="field__input field__input--num"
          type="text"
          inputMode="numeric"
          value={buffer}
          placeholder={placeholder ?? (optional ? '未入力' : '0')}
          onFocus={() => (focused.current = true)}
          onBlur={() => (focused.current = false)}
          onChange={(e) => handleChange(e.target.value)}
        />
        <span className="field__suffix">{suffix}</span>
      </span>
      {hint ? <span className="field__hint">{hint}</span> : null}
    </label>
  )
}

type TextFieldProps = {
  id?: string
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: 'text' | 'date'
}

export function TextField({ id, label, value, onChange, placeholder, type = 'text' }: TextFieldProps) {
  return (
    <label className="field" htmlFor={id}>
      <span className="field__label">{label}</span>
      <input
        id={id}
        className="field__input"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

type SelectFieldProps<T extends string> = {
  id?: string
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}

export function SelectField<T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: SelectFieldProps<T>) {
  return (
    <label className="field" htmlFor={id}>
      <span className="field__label">{label}</span>
      <select
        id={id}
        className="field__input"
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

type CheckFieldProps = {
  id?: string
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}

export function CheckField({ id, label, checked, onChange }: CheckFieldProps) {
  return (
    <label className="check" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  )
}
