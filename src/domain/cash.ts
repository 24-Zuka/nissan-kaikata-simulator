/**
 * 現金一括プラン（純粋関数）。
 *
 * - 車両見積総額から下取り控除した「支払対象総額」を一括で支払う。
 * - 維持費は別途必要（おまとめではないため全額が別途）。
 * - 月々の支払は「0円」を金額として表示する（文字だけの『一括』にしない）。
 * - 実質総額 = 支払対象総額 + 維持費合計（下取りは支払対象総額で控除済み＝二重控除しない）。
 */

import type { PlanResult, Scenario } from './types'
import { PLAN_LABELS } from './constants'
import { createBreakdown, effectiveMonthlyOf, type PlanContext } from './planHelpers'

export function calculateCashPlan(scenario: Scenario, ctx: PlanContext): PlanResult {
  const { estimate, maintenance, comparisonMonths } = ctx
  const payable = estimate.payableTotal

  const totalPayment = payable
  const effectiveTotal = payable + maintenance.total
  const effectiveMonthly = effectiveMonthlyOf(effectiveTotal, comparisonMonths)

  const breakdown = createBreakdown({
    vehiclePrice: scenario.vehiclePrice,
    optionPrice: scenario.optionPrice,
    taxAndFees: scenario.taxAndFees,
    discount: scenario.discount,
    tradeIn: estimate.tradeIn,
    principal: payable,
    downPayment: payable, // 全額を初回（一括）で支払う
    inspectionCost: maintenance.byKey.inspection,
    legalInspectionCost: maintenance.byKey.legalInspection,
    sixMonthInspectionCost: maintenance.byKey.sixMonthInspection,
    maintenanceCost: 0,
    tireCost: maintenance.byKey.tires,
    taxCost: maintenance.byKey.tax,
    insuranceCost: maintenance.byKey.insurance,
    omatomeIncludedCost: 0,
    omatomeExcludedCost: maintenance.total,
    interestFee: 0,
    residualValue: 0,
    totalPayment,
    effectiveTotal,
    effectiveMonthly,
  })

  return {
    planId: 'cash',
    label: PLAN_LABELS.cash,
    isVisible: true,
    isComplete: payable > 0,
    totalPayment,
    effectiveTotal,
    effectiveMonthly,
    initialPayment: payable,
    monthlyPayment: 0, // 一括（0円/月）。UIは必ず金額で表示する。
    secondAndLaterMonthlyPayment: 0,
    finalPayment: 0,
    paymentCount: 0, // 一括
    bonusPayment: 0,
    bonusPaymentCount: 0,
    residualValue: 0,
    interestFee: 0,
    includedItems: [],
    excludedItems: ['車検', '法定12か月点検', '6か月点検', '夏・冬タイヤ', '自動車税', '任意保険'],
    breakdown,
    warnings: [],
  }
}
