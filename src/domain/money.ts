import Decimal from 'decimal.js'

export const ROUNDING_CONFIG = {
  monthlyPayment: {
    unit: 1,
    mode: 'floor',
  },
  totalPayment: {
    unit: 1,
    mode: 'round',
  },
  effectiveTotal: {
    unit: 1,
    mode: 'round',
  },
  firstPaymentAdjustment: {
    enabled: true,
  },
} as const

function toDecimal(value: unknown): Decimal {
  if (value instanceof Decimal) return value
  if (typeof value === 'string') {
    const normalized = value.replace(/[,\s￥¥円]/g, '')
    if (normalized === '') return new Decimal(0)
    value = normalized
  }

  try {
    const decimal = new Decimal(value as Decimal.Value)
    return decimal.isFinite() ? decimal : new Decimal(0)
  } catch {
    return new Decimal(0)
  }
}

export function normalizeYen(value: unknown): number {
  const decimal = toDecimal(value)
  if (decimal.isNegative()) return 0
  return decimal.floor().toNumber()
}

export function normalizeOptionalYen(value: unknown): number | '' {
  if (value === '' || value === null || value === undefined) return ''
  if (typeof value === 'string' && value.trim() === '') return ''
  return normalizeYen(value)
}

export function clampYen(value: unknown, min: number, max: number): number {
  const normalized = normalizeYen(value)
  return Math.min(Math.max(normalized, normalizeYen(min)), normalizeYen(max))
}

export function floorYen(value: Decimal): number {
  if (!value.isFinite() || value.isNegative()) return 0
  return value.floor().toNumber()
}

export function roundYen(value: Decimal): number {
  if (!value.isFinite() || value.isNegative()) return 0
  return value.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber()
}

export function ceilYen(value: Decimal): number {
  if (!value.isFinite() || value.isNegative()) return 0
  return value.ceil().toNumber()
}

export function formatYen(value: number): string {
  return `${normalizeYen(value).toLocaleString('ja-JP')}円`
}

export function formatYenOrBlank(value: number | ''): string {
  return value === '' ? '' : formatYen(value)
}

export function decimal(value: unknown): Decimal {
  return toDecimal(value)
}
