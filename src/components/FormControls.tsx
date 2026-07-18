import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react'

type FieldProps = {
  label: string
  hint?: string
  error?: string
  inputId?: string
  required?: boolean
  children: ReactNode
  wide?: boolean
}

export function Field({
  label,
  hint,
  error,
  inputId,
  required = false,
  children,
  wide = false,
}: FieldProps) {
  return (
    <div className={`field ${wide ? 'field--wide' : ''}`}>
      {inputId ? (
        <label className="field__label" htmlFor={inputId}>
          {label}
          {required && <span className="field__required">必須</span>}
        </label>
      ) : (
        <span className="field__label">
          {label}
          {required && <span className="field__required">必須</span>}
        </span>
      )}
      {children}
      {hint && <span className="field__hint" id={inputId ? `${inputId}-hint` : undefined}>{hint}</span>}
      {error && <span className="field__error" id={inputId ? `${inputId}-error` : undefined}>{error}</span>}
    </div>
  )
}

type NumberFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange'
> & {
  label: string
  value: number | ''
  onValueChange: (value: number | '') => void
  suffix?: string
  hint?: string
  error?: string
  required?: boolean
}

export function NumberField({
  label,
  value,
  onValueChange,
  suffix = '円',
  hint,
  error,
  required,
  id,
  min = 0,
  step = 1,
  ...props
}: NumberFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} inputId={id} required={required}>
      <span className="input-with-suffix">
        <input
          {...props}
          id={id}
          aria-label={label}
          aria-describedby={error ? `${id}-error` : hint && id ? `${id}-hint` : undefined}
          aria-invalid={error ? true : undefined}
          aria-required={required || undefined}
          type="number"
          inputMode="numeric"
          min={min}
          step={step}
          required={required}
          value={value}
          onChange={(event) =>
            onValueChange(event.target.value === '' ? '' : Number(event.target.value))
          }
        />
        {suffix && <span>{suffix}</span>}
      </span>
    </Field>
  )
}

type TextFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange'
> & {
  label: string
  value: string
  onValueChange: (value: string) => void
  hint?: string
  error?: string
  required?: boolean
}

export function TextField({
  label,
  value,
  onValueChange,
  hint,
  error,
  required,
  id,
  ...props
}: TextFieldProps) {
  return (
    <Field label={label} hint={hint} error={error} inputId={id} required={required}>
      <input
        {...props}
        id={id}
        aria-label={label}
        aria-describedby={error ? `${id}-error` : hint && id ? `${id}-hint` : undefined}
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
        required={required}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      />
    </Field>
  )
}

type SelectFieldProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'value' | 'onChange'
> & {
  label: string
  value: string
  onValueChange: (value: string) => void
  children: ReactNode
  hint?: string
}

export function SelectField({
  label,
  value,
  onValueChange,
  children,
  hint,
  ...props
}: SelectFieldProps) {
  return (
    <Field label={label} hint={hint}>
      <select
        {...props}
        aria-label={label}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
      >
        {children}
      </select>
    </Field>
  )
}

export function FormSection({
  title,
  description,
  children,
  id,
}: {
  title: string
  description?: string
  children: ReactNode
  id?: string
}) {
  return (
    <section className="form-section" id={id}>
      <div className="form-section__heading">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      <div className="form-grid">{children}</div>
    </section>
  )
}
