/**
 * 現状維持プラン（現在の車に乗り続ける）（純粋関数）。
 *
 * 含める項目: 過去の購入額・残債・残りローン支払・月の支払額・車検・点検・夏冬タイヤ・
 *            自動車税・任意保険・維持費。
 *
 * 表示条件は visibility.ts（過去購入額>0 または 月支払額>0 のときのみ比較表示）。
 *
 * TODO(SPEC): 過去購入額の合算方法、残ローンと残債の関係、現在車の維持費周期は
 *             既存仕様が無いため下記の素直な解釈を採用。NFS/実務確認で確定する。
 */

import type { PlanResult, Scenario } from './types'
import { PLAN_LABELS } from './constants'
import { createBreakdown, effectiveMonthlyOf, type PlanContext } from './planHelpers'
import { countInspections, countTireReplacements } from './maintenance'
import { getStatusQuoVisibility } from './visibility'
import { normalizeYen } from './money'
import { MAINTENANCE_CYCLE } from './constants'

export function calculateStatusQuoPlan(scenario: Scenario, ctx: PlanContext): PlanResult {
  const { comparisonMonths } = ctx
  const cc = scenario.currentCar
  const years = Math.max(0, Math.round(comparisonMonths / 12))

  const originalPurchasePrice = normalizeYen(cc.originalPurchasePrice)
  const remainingLoanBalance = normalizeYen(cc.remainingLoanBalance)
  const remainingLoanMonths = Math.max(0, Math.trunc(normalizeYen(cc.remainingLoanMonths)))
  const monthlyPayment = normalizeYen(cc.monthlyPayment)

  // 残りローン支払: 月額 × min(残回数, 比較月数)。残回数の上限制御。
  const payableLoanMonths = Math.min(remainingLoanMonths, comparisonMonths)
  const loanPaidByMonthly = monthlyPayment * payableLoanMonths
  // 残債と月額×残回数の大きい方は取らず、ローン支払は月額×残回数を採用。
  // 残債は内訳表示用に保持する。

  // 現在車の維持費（中古として周期計算）。
  const annualTax = normalizeYen(cc.annualTax)
  const inspectionUnit = normalizeYen(cc.inspectionCost)
  const maintenanceUnit = normalizeYen(cc.maintenanceCost)
  const tireUnit = normalizeYen(cc.tireCost)
  const insuranceMonthly = normalizeYen(cc.insuranceMonthly)

  const inspectionCount = countInspections(years, 'used')
  const tireCount = countTireReplacements(years, MAINTENANCE_CYCLE.tireDefaultCycleYears)

  const taxCost = annualTax * years
  const inspectionCost = inspectionUnit * inspectionCount
  const maintenanceCost = maintenanceUnit * years // 年あたり維持費 × 年数
  const tireCost = tireUnit * tireCount
  const insuranceCost = insuranceMonthly * 12 * years

  const maintenanceTotal = taxCost + inspectionCost + maintenanceCost + tireCost + insuranceCost

  // 支払総額（これから支払う額）= 残りローン支払。
  const totalPayment = loanPaidByMonthly
  // 実質総額 = 過去購入額 + これからのローン + 維持費。
  const effectiveTotal = originalPurchasePrice + loanPaidByMonthly + maintenanceTotal
  const effectiveMonthly = effectiveMonthlyOf(effectiveTotal, comparisonMonths)

  const visibility = getStatusQuoVisibility(cc)

  const breakdown = createBreakdown({
    principal: remainingLoanBalance,
    downPayment: 0,
    inspectionCost,
    maintenanceCost,
    tireCost,
    taxCost,
    insuranceCost,
    omatomeExcludedCost: maintenanceTotal,
    totalPayment,
    effectiveTotal,
    effectiveMonthly,
  })

  return {
    planId: 'statusQuo',
    label: PLAN_LABELS.statusQuo,
    // 比較表・印刷では visibility に従う（未入力時は非表示）。
    isVisible: visibility.showInDetailComparison,
    isComplete: originalPurchasePrice > 0 || monthlyPayment > 0,
    totalPayment,
    effectiveTotal,
    effectiveMonthly,
    initialPayment: 0,
    monthlyPayment,
    secondAndLaterMonthlyPayment: monthlyPayment,
    finalPayment: 0,
    paymentCount: payableLoanMonths,
    bonusPayment: 0,
    bonusPaymentCount: 0,
    residualValue: 0,
    interestFee: 0,
    includedItems: [],
    excludedItems: [],
    breakdown,
    warnings: [],
  }
}
