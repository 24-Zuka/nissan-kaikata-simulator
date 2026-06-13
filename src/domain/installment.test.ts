import { describe, it, expect } from 'vitest'
import { computeInstallment, canRepay, findMinimalMonthly } from './installment'

describe('canRepay', () => {
  it('元金0は常にtrue', () => {
    expect(canRepay(0, 0, 60, 3.9)).toBe(true)
  })
  it('回数0は完済不能(元金あり)', () => {
    expect(canRepay(10000, 1_000_000, 0, 3.9)).toBe(false)
  })
  it('金利0%: 元金/回数 以上で完済', () => {
    // 1,200,000 / 60 = 20,000
    expect(canRepay(20000, 1_200_000, 60, 0)).toBe(true)
    expect(canRepay(19999, 1_200_000, 60, 0)).toBe(false)
  })
  it('単調性: 一度trueになったら下げない限り維持', () => {
    const p = 2_000_000
    const min = findMinimalMonthly(p, 60, 4.5)
    expect(canRepay(min, p, 60, 4.5)).toBe(true)
    expect(canRepay(min - 1, p, 60, 4.5)).toBe(false)
    expect(canRepay(min + 1000, p, 60, 4.5)).toBe(true)
  })
})

describe('findMinimalMonthly 境界テーブル', () => {
  const rates = [0, 2.9, 3.9, 5.9, 9.9]
  const terms = [12, 36, 60, 84, 120]
  const prices = [1_000_000, 2_500_000, 4_000_000]
  for (const rate of rates) {
    for (const months of terms) {
      for (const price of prices) {
        it(`rate=${rate}% months=${months} price=${price}: min-1で完済不能`, () => {
          const min = findMinimalMonthly(price, months, rate)
          expect(min).toBeGreaterThan(0)
          expect(canRepay(min, price, months, rate)).toBe(true)
          expect(canRepay(min - 1, price, months, rate)).toBe(false)
        })
      }
    }
  }
})

describe('computeInstallment 不変条件', () => {
  it('支払予定の総和 = 月々支払総和 (初回 + 均等×(n-1))', () => {
    const r = computeInstallment({ principal: 2_400_000, months: 60, annualRate: 3.9 })
    expect(r.initialPayment + r.equalMonthly * (r.monthlyCount - 1)).toBe(r.monthlyScheduleTotal)
  })
  it('金利0%: 総額 = 元金 (手数料0)', () => {
    const r = computeInstallment({ principal: 1_200_000, months: 60, annualRate: 0 })
    expect(r.monthlyScheduleTotal).toBe(1_200_000)
    expect(r.totalPayment).toBe(1_200_000)
    expect(r.interestFee).toBe(0)
    expect(r.equalMonthly).toBe(20_000)
  })
  it('有金利: 手数料 > 0 かつ 総額 = 元金 + 手数料', () => {
    const r = computeInstallment({ principal: 2_400_000, months: 60, annualRate: 3.9 })
    expect(r.interestFee).toBeGreaterThan(0)
    expect(r.totalPayment).toBe(r.principal + r.interestFee)
  })
  it('退化ケース: 元金0は0円系列', () => {
    const r = computeInstallment({ principal: 0, months: 60, annualRate: 3.9 })
    expect(r.totalPayment).toBe(0)
    expect(r.equalMonthly).toBe(0)
    expect(r.initialPayment).toBe(0)
  })
  it('退化ケース: 回数0は0円系列', () => {
    const r = computeInstallment({ principal: 1_000_000, months: 0, annualRate: 3.9 })
    expect(r.totalPayment).toBe(0)
  })
  it('全返却値が非負整数', () => {
    const r = computeInstallment({ principal: 3_333_333, months: 77, annualRate: 5.5 })
    for (const v of [
      r.initialPayment,
      r.equalMonthly,
      r.monthlyScheduleTotal,
      r.totalPayment,
      r.interestFee,
      r.bonusTotal,
      r.finalPayment,
    ]) {
      expect(Number.isInteger(v)).toBe(true)
      expect(v).toBeGreaterThanOrEqual(0)
    }
  })

  it('ボーナス併用: ボーナス回数=年×ボーナス月数, 総額にボーナス内包', () => {
    const r = computeInstallment({
      principal: 3_000_000,
      months: 60,
      annualRate: 3.9,
      bonusPayment: 100_000,
      bonusMonths: [1, 7],
    })
    expect(r.bonusCount).toBe(10) // 5年 × 年2回
    expect(r.bonusTotal).toBe(1_000_000)
    expect(r.totalPayment).toBe(r.monthlyScheduleTotal + r.bonusTotal)
    // ボーナス併用で月々は単独より小さくなる。
    const noBonus = computeInstallment({ principal: 3_000_000, months: 60, annualRate: 3.9 })
    expect(r.equalMonthly).toBeLessThan(noBonus.equalMonthly)
  })
})

describe('BVC残価（balloon）', () => {
  it('残価を含む元金全体に利息が乗る（残価控除後だけに利息にしない）', () => {
    const principal = 3_000_000
    const residual = 1_000_000
    const months = 60
    const rate = 3.9
    const bvc = computeInstallment({
      principal,
      months,
      annualRate: rate,
      residual,
      includeResidualInTotal: true,
    })
    // 誤実装: 残価控除後(principal-residual)を通常クレジットにした場合の利息。
    const wrong = computeInstallment({ principal: principal - residual, months, annualRate: rate })
    // BVCの利息は、残価分にも利息が乗るため誤実装より大きい。
    expect(bvc.interestFee).toBeGreaterThan(wrong.interestFee)
  })
  it('買取と返却の総額差 = 残価', () => {
    const base = {
      principal: 3_000_000,
      months: 60,
      annualRate: 3.9,
      residual: 1_000_000,
    }
    const buy = computeInstallment({ ...base, includeResidualInTotal: true })
    const ret = computeInstallment({ ...base, includeResidualInTotal: false })
    expect(buy.totalPayment - ret.totalPayment).toBe(1_000_000)
  })
})
