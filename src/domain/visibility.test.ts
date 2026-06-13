import { describe, it, expect } from 'vitest'
import { getStatusQuoVisibility } from './visibility'
import { createEmptyCurrentCar } from './constants'
import type { CurrentCarInput } from './types'

function cc(partial: Partial<CurrentCarInput>): CurrentCarInput {
  return { ...createEmptyCurrentCar(), ...partial }
}

describe('getStatusQuoVisibility', () => {
  it('全未入力なら全比較系がfalse', () => {
    const v = getStatusQuoVisibility(createEmptyCurrentCar())
    expect(v.showInDetailComparison).toBe(false)
    expect(v.showInPrintComparison).toBe(false)
    expect(v.showInCustomerPresentation).toBe(false)
    expect(v.showInDifferenceComparison).toBe(false)
    expect(v.showPastPurchasePriceRow).toBe(false)
  })

  it('過去購入額>0 で表示', () => {
    const v = getStatusQuoVisibility(cc({ originalPurchasePrice: 2_000_000 }))
    expect(v.showInDetailComparison).toBe(true)
    expect(v.showInPrintComparison).toBe(true)
    expect(v.showPastPurchasePriceRow).toBe(true)
  })

  it('月の支払額>0 で表示（過去購入額行は出さない）', () => {
    const v = getStatusQuoVisibility(cc({ monthlyPayment: 30_000 }))
    expect(v.showInDetailComparison).toBe(true)
    expect(v.showPastPurchasePriceRow).toBe(false)
  })

  it('不正値（NaN/負数/Infinity/小数/文字/undefined）でクラッシュせず非表示', () => {
    expect(getStatusQuoVisibility(cc({ originalPurchasePrice: NaN as unknown as number }))
      .showInDetailComparison).toBe(false)
    expect(getStatusQuoVisibility(cc({ originalPurchasePrice: -100 as unknown as number }))
      .showInDetailComparison).toBe(false)
    expect(getStatusQuoVisibility(cc({ monthlyPayment: Infinity as unknown as number }))
      .showInDetailComparison).toBe(false)
    expect(getStatusQuoVisibility(cc({ originalPurchasePrice: 0.4 as unknown as number }))
      .showInDetailComparison).toBe(false) // 切り捨てで0
    expect(getStatusQuoVisibility(cc({ originalPurchasePrice: 'abc' as unknown as number }))
      .showInDetailComparison).toBe(false)
  })

  it('小数 0.4 は切り捨てで非表示、1.2 は表示', () => {
    expect(getStatusQuoVisibility(cc({ monthlyPayment: 0.4 as unknown as number }))
      .showInDetailComparison).toBe(false)
    expect(getStatusQuoVisibility(cc({ monthlyPayment: 1.2 as unknown as number }))
      .showInDetailComparison).toBe(true)
  })
})
