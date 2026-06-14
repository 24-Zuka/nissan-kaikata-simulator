/**
 * クレジットプラン（NFS方式・元利均等）（純粋関数）。
 *
 * - 分割対象元金 = 支払対象総額 − 頭金（principalOverride があれば優先）。
 * - 元利均等の閉形式で理論月額を求め、初回支払額で端数調整。
 * - 維持費は別途必要（全額が別途）。
 */

import type { PlanResult, Scenario } from './types'
import { PLAN_LABELS } from './constants'
import { createBreakdown, effectiveMonthlyOf, type PlanContext } from './planHelpers'
import { computeInstallment, resolveOfficialQuote } from './installment'
import { normalizeYen } from './money'

export function calculateCreditPlan(scenario: Scenario, ctx: PlanContext): PlanResult {
  const { estimate, maintenance, comparisonMonths } = ctx
  const input = scenario.credit

  const downPayment = normalizeYen(input.downPayment)
  const principal =
    input.principalOverride !== undefined
      ? normalizeYen(input.principalOverride)
      : Math.max(0, estimate.payableTotal - downPayment)

  const inst = computeInstallment({
    principal,
    months: input.months,
    annualRate: input.annualRate,
    residual: 0,
    includeResidualInTotal: true,
    bonusPayment: input.bonusPayment,
    bonusMonths: input.bonusMonths,
  })

  // 正式見積（手入力）があれば手入力値を優先する。
  const official = resolveOfficialQuote(input.official)
  const initialPayment = official ? official.initialPayment : inst.initialPayment
  const equalMonthly = official ? official.equalMonthly : inst.equalMonthly
  const paymentCount = official ? official.paymentCount : inst.monthlyCount
  const scheduleTotal = official ? official.monthlyScheduleTotal : inst.monthlyScheduleTotal
  const installmentTotal = official ? scheduleTotal : inst.totalPayment
  const interestFee = official
    ? Math.max(0, installmentTotal - principal)
    : inst.interestFee

  const totalPayment = downPayment + installmentTotal
  const effectiveTotal = totalPayment + maintenance.total
  const effectiveMonthly = effectiveMonthlyOf(effectiveTotal, comparisonMonths)

  const breakdown = createBreakdown({
    vehiclePrice: scenario.vehiclePrice,
    optionPrice: scenario.optionPrice,
    taxAndFees: scenario.taxAndFees,
    discount: scenario.discount,
    tradeIn: estimate.tradeIn,
    principal,
    downPayment,
    inspectionCost: maintenance.byKey.inspection,
    legalInspectionCost: maintenance.byKey.legalInspection,
    sixMonthInspectionCost: maintenance.byKey.sixMonthInspection,
    tireCost: maintenance.byKey.tires,
    taxCost: maintenance.byKey.tax,
    insuranceCost: maintenance.byKey.insurance,
    omatomeExcludedCost: maintenance.total,
    interestFee,
    residualValue: 0,
    totalPayment,
    effectiveTotal,
    effectiveMonthly,
  })

  return {
    planId: 'credit',
    label: PLAN_LABELS.credit,
    isVisible: true,
    isComplete: principal > 0 && (official ? true : normalizeYen(input.months) > 0),
    totalPayment,
    effectiveTotal,
    effectiveMonthly,
    initialPayment,
    monthlyPayment: equalMonthly,
    secondAndLaterMonthlyPayment: equalMonthly,
    finalPayment: equalMonthly,
    paymentCount,
    bonusPayment: official ? 0 : inst.bonusPayment,
    bonusPaymentCount: official ? 0 : inst.bonusCount,
    residualValue: 0,
    interestFee,
    includedItems: [],
    excludedItems: ['車検', '法定12か月点検', '6か月点検', '夏・冬タイヤ', '自動車税', '任意保険'],
    breakdown,
    warnings: [],
  }
}
