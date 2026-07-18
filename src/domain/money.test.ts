import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'
import {
  ceilYen,
  clampYen,
  floorYen,
  formatYen,
  normalizeOptionalYen,
  normalizeYen,
  roundYen,
} from './money'

describe('money', () => {
  it.each([
    [undefined, 0],
    [null, 0],
    ['', 0],
    ['1,234円', 1234],
    [-100, 0],
    [12.9, 12],
    [Number.NaN, 0],
    [Number.POSITIVE_INFINITY, 0],
    [new Decimal('99.99'), 99],
  ])('normalizeYen(%s)', (input, expected) => {
    expect(normalizeYen(input)).toBe(expected)
  })

  it('optional input keeps blank state', () => {
    expect(normalizeOptionalYen('')).toBe('')
    expect(normalizeOptionalYen('  ')).toBe('')
    expect(normalizeOptionalYen('1,500')).toBe(1500)
  })

  it('clamps and rounds yen safely', () => {
    expect(clampYen(120, 0, 100)).toBe(100)
    expect(floorYen(new Decimal('10.9'))).toBe(10)
    expect(roundYen(new Decimal('10.5'))).toBe(11)
    expect(ceilYen(new Decimal('10.1'))).toBe(11)
    expect(formatYen(1234567)).toBe('1,234,567円')
  })
})
