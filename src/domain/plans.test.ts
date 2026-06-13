import { describe, it, expect } from 'vitest'
import { calculateScenario, calculateBvcBoth, calcVehicleEstimate } from './scenario'
import type { PlanContext } from './scenario'
import { calculateMaintenance } from './maintenance'
import { makeScenario } from '../test/helpers/makeScenario'
import type { PlanResult } from './types'

function ctxOf(scenario: ReturnType<typeof makeScenario>): PlanContext {
  const estimate = calcVehicleEstimate(scenario)
  const years = scenario.maintenance.simulationYears
  const maintenance = calculateMaintenance(scenario.maintenance, {
    vehicleMode: scenario.vehicleMode,
    years,
  })
  return { estimate, maintenance, comparisonMonths: years * 12 }
}

const baseScenario = makeScenario({
  vehiclePrice: 2_500_000,
  optionPrice: 300_000,
  taxAndFees: 200_000,
  discount: 100_000,
  tradeIn: 400_000,
})

describe('車両見積（estimate）', () => {
  it('下取りは車両見積総額を超えてクランプ', () => {
    const s = makeScenario({ vehiclePrice: 1_000_000, optionPrice: 0, taxAndFees: 0, discount: 0, tradeIn: 5_000_000 })
    const e = calcVehicleEstimate(s)
    expect(e.grossTotal).toBe(1_000_000)
    expect(e.tradeIn).toBe(1_000_000)
    expect(e.payableTotal).toBe(0)
  })
  it('支払対象総額 = 総額 - 下取り（二重控除しない）', () => {
    const e = calcVehicleEstimate(baseScenario)
    // 2,500,000+300,000+200,000-100,000 = 2,900,000 ; -400,000 = 2,500,000
    expect(e.grossTotal).toBe(2_900_000)
    expect(e.payableTotal).toBe(2_500_000)
  })
})

describe('現金一括', () => {
  it('月々の支払は0円（金額として保持）', () => {
    const r = calculateScenario(baseScenario).cash
    expect(r.monthlyPayment).toBe(0)
    expect(Number.isInteger(r.monthlyPayment)).toBe(true)
  })
  it('実質総額 = 支払対象総額 + 維持費（下取り二重控除なし）', () => {
    const ctx = ctxOf(baseScenario)
    const r = calculateScenario(baseScenario).cash
    expect(r.totalPayment).toBe(ctx.estimate.payableTotal)
    expect(r.effectiveTotal).toBe(ctx.estimate.payableTotal + ctx.maintenance.total)
  })
})

describe('クレジット', () => {
  it('支払予定の総和 = 支払総額（頭金含む）', () => {
    const s = makeScenario({
      ...baseScenario,
      credit: { downPayment: 300_000, annualRate: 3.9, months: 60, bonusPayment: 0, bonusMonths: [] },
    })
    const r = calculateScenario(s).credit
    const scheduleSum = r.initialPayment + r.secondAndLaterMonthlyPayment * 59
    expect(scheduleSum + r.breakdown.downPayment).toBe(r.totalPayment)
  })
})

describe('BVC 返却/買取', () => {
  it('買取と返却の支払総額差 = 残価相当', () => {
    const s = makeScenario({
      ...baseScenario,
      bvc: {
        downPayment: 0,
        annualRate: 3.9,
        months: 60,
        residualValue: 1_000_000,
        bonusPayment: 0,
        bonusMonths: [],
        mode: 'return',
      },
    })
    const both = calculateBvcBoth(s, ctxOf(s))
    expect(both.residualDiff).toBe(1_000_000)
    expect(both.purchase.finalPayment).toBe(1_000_000)
    expect(both.return.finalPayment).toBe(0)
  })
})

describe('おまとめプラン', () => {
  it('含む維持費は二重計上しない（実質総額 = 支払総額 + 別途維持費）', () => {
    const s = makeScenario({
      ...baseScenario,
      omatome: {
        months: 60,
        downPayment: 0,
        annualRate: 3.9,
        includeInspection: true,
        includeLegalInspection: true,
        includeSixMonthInspection: true,
        includeTires: true,
        includeTax: true,
        includeInsurance: false,
        monthlyPayment: '',
      },
    })
    const r = calculateScenario(s).omatome
    expect(r.effectiveTotal).toBe(r.totalPayment + r.breakdown.omatomeExcludedCost)
    // 全部含めたので別途は0（保険は未入力で対象外＝excludedに保険0が入るが合計0）
    expect(r.breakdown.omatomeExcludedCost).toBe(0)
    expect(r.includedItems).toContain('夏・冬タイヤ')
    expect(r.label).toBe('おまとめプラン')
  })

  it('一部のみ含める場合、含む+別途 = 維持費合計', () => {
    const ctx = ctxOf(baseScenario)
    const s = makeScenario({
      ...baseScenario,
      omatome: {
        months: 60,
        downPayment: 0,
        annualRate: 3.9,
        includeInspection: true,
        includeLegalInspection: false,
        includeSixMonthInspection: false,
        includeTires: false,
        includeTax: false,
        includeInsurance: false,
        monthlyPayment: '',
      },
    })
    const r = calculateScenario(s).omatome
    expect(r.breakdown.omatomeIncludedCost + r.breakdown.omatomeExcludedCost).toBe(ctx.maintenance.total)
  })
})

describe('現状維持', () => {
  it('未入力なら isVisible=false', () => {
    const r = calculateScenario(baseScenario).statusQuo
    expect(r.isVisible).toBe(false)
  })
  it('過去購入額入力で isVisible=true、実質総額に過去購入額を合算', () => {
    const s = makeScenario({
      ...baseScenario,
      currentCar: { ...baseScenario.currentCar, originalPurchasePrice: 2_000_000, monthlyPayment: 30_000, remainingLoanMonths: 12 },
    })
    const r = calculateScenario(s).statusQuo
    expect(r.isVisible).toBe(true)
    // 残ローン 30,000×12 + 過去 2,000,000 + 維持費 が含まれる
    expect(r.effectiveTotal).toBeGreaterThanOrEqual(2_000_000 + 30_000 * 12)
  })
})

describe('整合性: 全プラン非負整数', () => {
  it('全プランの主要金額が非負整数', () => {
    const s = makeScenario({
      ...baseScenario,
      currentCar: { ...baseScenario.currentCar, originalPurchasePrice: 1_500_000 },
    })
    const result = calculateScenario(s)
    const plans: PlanResult[] = [result.statusQuo, result.cash, result.credit, result.bvc, result.omatome]
    for (const p of plans) {
      for (const v of [
        p.totalPayment,
        p.effectiveTotal,
        p.effectiveMonthly,
        p.initialPayment,
        p.monthlyPayment,
        p.secondAndLaterMonthlyPayment,
        p.finalPayment,
        p.bonusPayment,
        p.residualValue,
        p.interestFee,
      ]) {
        expect(Number.isInteger(v), `${p.planId}: ${v}`).toBe(true)
        expect(v, `${p.planId}: ${v}`).toBeGreaterThanOrEqual(0)
        expect(Number.isFinite(v)).toBe(true)
      }
    }
  })
})
