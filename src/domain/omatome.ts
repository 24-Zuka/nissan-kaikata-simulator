/**
 * おまとめプラン（純粋関数）。
 *
 * 表示名は必ず「おまとめプラン」。リース商品として説明しない。
 *
 * - 車両費用に「含める維持費」をまとめて分割する。
 * - 含めた維持費は分割（実質月額・実質総額）に内包し、別途維持費は二重計上しない。
 * - omatomeIncludedCost（含む）と omatomeExcludedCost（別途）を区分する。
 * - 任意保険は includeInsurance かつ入力済みのときのみ含める。
 */

import type { PlanResult, Scenario } from './types'
import type { MaintenanceItemKey } from './maintenance'
import { PLAN_LABELS } from './constants'
import { createBreakdown, effectiveMonthlyOf, type PlanContext } from './planHelpers'
import { computeInstallment, resolveOfficialQuote } from './installment'
import { normalizeYen } from './money'

const ITEM_LABELS: Record<MaintenanceItemKey, string> = {
  inspection: '車検',
  legalInspection: '法定12か月点検',
  sixMonthInspection: '6か月点検',
  tires: '夏・冬タイヤ',
  tax: '自動車税',
  insurance: '任意保険',
}

export function calculateOmatomePlan(scenario: Scenario, ctx: PlanContext): PlanResult {
  const { estimate, maintenance, comparisonMonths } = ctx
  const input = scenario.omatome

  // どの維持費を含めるか（二重計上防止のため byKey から1回だけ参照）。
  const includeMap: Record<MaintenanceItemKey, boolean> = {
    inspection: input.includeInspection,
    legalInspection: input.includeLegalInspection,
    sixMonthInspection: input.includeSixMonthInspection,
    tires: input.includeTires,
    tax: input.includeTax,
    // 任意保険は入力済みのときのみ。
    insurance: input.includeInsurance && maintenance.insuranceEntered,
  }

  const includedItems: string[] = []
  const excludedItems: string[] = []
  let omatomeIncludedCost = 0
  let omatomeExcludedCost = 0
  const keys: MaintenanceItemKey[] = [
    'inspection',
    'legalInspection',
    'sixMonthInspection',
    'tires',
    'tax',
    'insurance',
  ]
  for (const key of keys) {
    const cost = maintenance.byKey[key]
    if (includeMap[key]) {
      omatomeIncludedCost += cost
      includedItems.push(ITEM_LABELS[key])
    } else {
      omatomeExcludedCost += cost
      excludedItems.push(ITEM_LABELS[key])
    }
  }

  const downPayment = normalizeYen(input.downPayment)
  // おまとめ対象 = 車両支払対象総額 + 含める維持費。
  const financedBase = estimate.payableTotal + omatomeIncludedCost
  const principal = Math.max(0, financedBase - downPayment)
  const months = Math.max(0, Math.trunc(normalizeYen(input.months)))

  // 月額の直接上書き（正式見積転記用）。指定時はその月額で総額を再構成する。
  const overrideMonthly =
    typeof input.monthlyPayment === 'number' && input.monthlyPayment > 0
      ? normalizeYen(input.monthlyPayment)
      : null

  // 正式見積（初回/2回目以降月額/回数）の手入力があれば最優先。
  const official = resolveOfficialQuote(input.official)

  let initialPayment: number
  let equalMonthly: number
  let installmentTotal: number
  let interestFee: number
  let paymentCount: number

  if (official) {
    initialPayment = official.initialPayment
    equalMonthly = official.equalMonthly
    installmentTotal = official.monthlyScheduleTotal
    interestFee = Math.max(0, installmentTotal - principal)
    paymentCount = official.paymentCount
  } else if (overrideMonthly !== null && months > 0) {
    equalMonthly = overrideMonthly
    installmentTotal = overrideMonthly * months
    initialPayment = overrideMonthly
    interestFee = Math.max(0, installmentTotal - principal)
    paymentCount = months
  } else {
    const inst = computeInstallment({
      principal,
      months,
      annualRate: input.annualRate,
      residual: 0,
      includeResidualInTotal: true,
    })
    initialPayment = inst.initialPayment
    equalMonthly = inst.equalMonthly
    installmentTotal = inst.totalPayment
    interestFee = inst.interestFee
    paymentCount = months
  }

  const totalPayment = downPayment + installmentTotal
  // 実質総額 = おまとめ支払総額（含む維持費は内包済み）+ 別途維持費（二重計上しない）。
  const effectiveTotal = totalPayment + omatomeExcludedCost
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
    omatomeIncludedCost,
    omatomeExcludedCost,
    interestFee,
    residualValue: 0,
    totalPayment,
    effectiveTotal,
    effectiveMonthly,
  })

  return {
    planId: 'omatome',
    label: PLAN_LABELS.omatome,
    isVisible: true,
    isComplete: principal > 0 && (official ? true : months > 0),
    totalPayment,
    effectiveTotal,
    effectiveMonthly,
    initialPayment,
    monthlyPayment: equalMonthly,
    secondAndLaterMonthlyPayment: equalMonthly,
    finalPayment: equalMonthly,
    paymentCount,
    bonusPayment: 0,
    bonusPaymentCount: 0,
    residualValue: 0,
    interestFee,
    includedItems,
    excludedItems,
    breakdown,
    warnings: [],
  }
}
