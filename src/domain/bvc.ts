/**
 * BVC（ビッグバリュークレジット＝残価据置型クレジット）（純粋関数）。
 *
 * 重要:
 * - 残価は最終回支払額として据え置く。
 * - 利息は残価を含む元金全体に対して発生する（「車両価格−残価」だけに利息をかけない）。
 *   computeInstallment は残価の現在価値のみ月額按分から外し、残価分の利息は支払総額に内包する。
 * - 買取時: 最終回に残価を支払う → 支払総額に残価を含める。
 * - 返却時: 最終回支払（残価）が発生しない → 支払総額に残価を含めない。
 * - 返却・買取の差額が残価相当になる。
 */

import type { BvcInput, PlanResult, Scenario } from './types'
import { PLAN_LABELS } from './constants'
import { createBreakdown, effectiveMonthlyOf, type PlanContext } from './planHelpers'
import { computeInstallment } from './installment'
import { clampYen, normalizeYen } from './money'

export function calculateBvcPlan(
  scenario: Scenario,
  ctx: PlanContext,
  modeOverride?: BvcInput['mode'],
): PlanResult {
  const { estimate, maintenance, comparisonMonths } = ctx
  const input = scenario.bvc
  const mode = modeOverride ?? input.mode

  const downPayment = normalizeYen(input.downPayment)
  const principal = Math.max(0, estimate.payableTotal - downPayment)
  // 残価は 0〜元金 にクランプ（残価が元金を超えないように）。
  const residual = clampYen(input.residualValue, 0, principal)

  const isPurchase = mode === 'purchase'

  const inst = computeInstallment({
    principal,
    months: input.months,
    annualRate: input.annualRate,
    residual,
    includeResidualInTotal: isPurchase,
    bonusPayment: input.bonusPayment,
    bonusMonths: input.bonusMonths,
  })

  const totalPayment = downPayment + inst.totalPayment
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
    interestFee: inst.interestFee,
    residualValue: residual,
    totalPayment,
    effectiveTotal,
    effectiveMonthly,
  })

  return {
    planId: 'bvc',
    label: PLAN_LABELS.bvc,
    isVisible: true,
    isComplete: principal > 0 && normalizeYen(input.months) > 0,
    totalPayment,
    effectiveTotal,
    effectiveMonthly,
    initialPayment: inst.initialPayment,
    monthlyPayment: inst.equalMonthly,
    secondAndLaterMonthlyPayment: inst.equalMonthly,
    // 最終回支払額 = 残価（買取時は支払う、返却時は支払わない）。
    finalPayment: isPurchase ? residual : 0,
    paymentCount: inst.monthlyCount,
    bonusPayment: inst.bonusPayment,
    bonusPaymentCount: inst.bonusCount,
    residualValue: residual,
    interestFee: inst.interestFee,
    includedItems: [],
    excludedItems: ['車検', '法定12か月点検', '6か月点検', '夏・冬タイヤ', '自動車税', '任意保険'],
    breakdown,
    warnings:
      residual > 0
        ? ['残価が最終回に据え置かれます。月額だけでなく最終回支払（残価）も含めてご確認ください。']
        : [],
  }
}

/** 返却・買取の両方を計算して返す（お客様説明モードの比較用）。 */
export function calculateBvcBoth(
  scenario: Scenario,
  ctx: PlanContext,
): { return: PlanResult; purchase: PlanResult; residualDiff: number } {
  const ret = calculateBvcPlan(scenario, ctx, 'return')
  const buy = calculateBvcPlan(scenario, ctx, 'purchase')
  // 差額は残価相当になるはず（検証可能）。
  const residualDiff = Math.max(0, buy.totalPayment - ret.totalPayment)
  return { return: ret, purchase: buy, residualDiff }
}
