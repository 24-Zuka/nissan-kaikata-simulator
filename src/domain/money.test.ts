import { describe, it, expect } from 'vitest'
import {
  normalizeYen,
  normalizeOptionalYen,
  clampYen,
  floorYen,
  roundYen,
  ceilYen,
  formatYen,
  formatYenOrBlank,
  Decimal,
} from './money'

describe('normalizeYen', () => {
  it('有限・非負・整数はそのまま', () => {
    expect(normalizeYen(0)).toBe(0)
    expect(normalizeYen(1234)).toBe(1234)
    expect(normalizeYen(1_000_000)).toBe(1_000_000)
  })

  it('小数は切り捨て', () => {
    expect(normalizeYen(1234.99)).toBe(1234)
    expect(normalizeYen(0.9)).toBe(0)
  })

  it('数値文字列を受け付ける', () => {
    expect(normalizeYen('1500')).toBe(1500)
    expect(normalizeYen('1,500')).toBe(0) // カンマ付きは不正としてフォールバック
    expect(normalizeYen('  2000 ')).toBe(2000)
  })

  it('NaN / Infinity / -Infinity は 0', () => {
    expect(normalizeYen(NaN)).toBe(0)
    expect(normalizeYen(Infinity)).toBe(0)
    expect(normalizeYen(-Infinity)).toBe(0)
  })

  it('負数は 0', () => {
    expect(normalizeYen(-1)).toBe(0)
    expect(normalizeYen(-99999)).toBe(0)
  })

  it('非数・null・undefined・空文字は 0', () => {
    expect(normalizeYen('abc')).toBe(0)
    expect(normalizeYen(null)).toBe(0)
    expect(normalizeYen(undefined)).toBe(0)
    expect(normalizeYen('')).toBe(0)
    expect(normalizeYen({})).toBe(0)
    expect(normalizeYen([])).toBe(0)
  })

  it('Decimal入力を受け付ける', () => {
    expect(normalizeYen(new Decimal('1234.7'))).toBe(1234)
    expect(normalizeYen(new Decimal(-5))).toBe(0)
  })
})

describe('normalizeOptionalYen', () => {
  it('未入力は空のまま', () => {
    expect(normalizeOptionalYen('')).toBe('')
    expect(normalizeOptionalYen(null)).toBe('')
    expect(normalizeOptionalYen(undefined)).toBe('')
  })
  it('値があれば正規化', () => {
    expect(normalizeOptionalYen('3000')).toBe(3000)
    expect(normalizeOptionalYen(-1)).toBe(0)
    expect(normalizeOptionalYen(NaN)).toBe(0)
  })
})

describe('clampYen', () => {
  it('範囲内はそのまま', () => {
    expect(clampYen(50, 0, 100)).toBe(50)
  })
  it('下限・上限でクランプ', () => {
    expect(clampYen(-10, 0, 100)).toBe(0)
    expect(clampYen(200, 0, 100)).toBe(100)
  })
  it('max < min のとき min に揃える', () => {
    expect(clampYen(50, 100, 0)).toBe(100)
  })
  it('不正入力でも安全', () => {
    expect(clampYen(NaN, 0, 100)).toBe(0)
  })
})

describe('floorYen / roundYen / ceilYen', () => {
  it('floor', () => {
    expect(floorYen(new Decimal('1234.99'))).toBe(1234)
  })
  it('round (四捨五入)', () => {
    expect(roundYen(new Decimal('1234.4'))).toBe(1234)
    expect(roundYen(new Decimal('1234.5'))).toBe(1235)
  })
  it('ceil', () => {
    expect(ceilYen(new Decimal('1234.01'))).toBe(1235)
  })
  it('負数・非有限は 0', () => {
    expect(floorYen(new Decimal(-1))).toBe(0)
    expect(roundYen(new Decimal(Infinity))).toBe(0)
    expect(ceilYen(new Decimal(NaN))).toBe(0)
  })
})

describe('formatYen', () => {
  it('カンマ区切り＋円', () => {
    expect(formatYen(1234567)).toBe('1,234,567円')
    expect(formatYen(0)).toBe('0円')
  })
  it('不正値は 0円', () => {
    expect(formatYen(NaN as unknown as number)).toBe('0円')
    expect(formatYen(-100)).toBe('0円')
  })
})

describe('formatYenOrBlank', () => {
  it('未入力は —', () => {
    expect(formatYenOrBlank('')).toBe('—')
  })
  it('値はフォーマット', () => {
    expect(formatYenOrBlank(3000)).toBe('3,000円')
  })
})
