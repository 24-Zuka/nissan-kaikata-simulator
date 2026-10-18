import { calculateMaintenance, maintenanceYearsToMonths } from './maintenance'
import { normalizeYen } from './money'
import { createPlanResult, effectiveMonthly } from './planHelpers'
import type { CurrentCarInput, PlanResult, Scenario, StatusQuoVisibility } from './types'

const FIRST_REGISTRATION_PATTERN = /^\d{4}-\d{2}$/

export function getStatusQuoVisibility(
  currentCar: CurrentCarInput,
): StatusQuoVisibility {
  const hasComparisonValue =
    normalizeYen(currentCar.originalPurchasePrice) > 0 ||
    normalizeYen(currentCar.monthlyPayment) > 0 ||
    normalizeYen(currentCar.remainingDebt) > 0

  // 現状維持は、過去購入額・今後の月払い・残債のいずれかが入力された場合に比較対象として表示する。
  return {
    showInDetailComparison: hasComparisonValue,
    showInPrintComparison: hasComparisonValue,
    showInCustomerPresentation: hasComparisonValue,
    showInDifferenceComparison: hasComparisonValue,
    showPastPurchasePriceRow: normalizeYen(currentCar.originalPurchasePrice) > 0,
  }
}

function monthIndex(year: number, month: number): number {
  return year * 12 + month
}

function currentMonthIndex(today = new Date()): number {
  return monthIndex(today.getFullYear(), today.getMonth())
}

function parseRegistrationMonth(value: string): number | null {
  if (!FIRST_REGISTRATION_PATTERN.test(value)) return null
  const [yearText, monthText] = value.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null
  }
  return monthIndex(year, month - 1)
}

export function calculateCurrentCarInspectionMonths(
  firstRegistrationMonth: string,
  maintenanceMonths: number,
  today = new Date(),
): { months: number[]; warning?: string } {
  const registrationMonth = parseRegistrationMonth(firstRegistrationMonth)
  const startMonth = currentMonthIndex(today)

  if (registrationMonth === null) {
    return {
      months: [],
      warning: '現在の車の初度登録年月が未入力のため、車検費用は計算していません。',
    }
  }
  if (registrationMonth > startMonth) {
    return {
      months: [],
      warning: '現在の車の初度登録年月が未来日のため、車検費用は計算していません。',
    }
  }

  const ageAtStart = startMonth - registrationMonth
  const ageAtEnd = ageAtStart + Math.max(0, Math.floor(maintenanceMonths || 0))
  const months: number[] = []

  for (let inspectionAge = 36; inspectionAge < ageAtEnd; inspectionAge += 24) {
    if (inspectionAge >= ageAtStart) months.push(inspectionAge - ageAtStart)
  }

  return { months }
}

export function calculateStatusQuo(scenario: Scenario): PlanResult {
  const current = scenario.currentCar
  const visibility = getStatusQuoVisibility(current)
  const remainingPayments = Math.max(0, Math.floor(Number(current.remainingPayments) || 0))
  const monthlyPayment = normalizeYen(current.monthlyPayment)
  const scheduledRemaining = monthlyPayment * remainingPayments
  const remainingDebt = normalizeYen(current.remainingDebt)
  const futureLoanPayment = scheduledRemaining > 0 ? scheduledRemaining : remainingDebt
  const originalPurchasePrice = normalizeYen(current.originalPurchasePrice)
  const maintenanceMonths = maintenanceYearsToMonths(current.currentMaintenanceYears)
  let currentCarInspections = calculateCurrentCarInspectionMonths(
    current.firstRegistrationMonth,
    maintenanceMonths,
    scenario.strictInput && scenario.quote.quoteDate ? new Date(scenario.quote.quoteDate + 'T12:00:00') : new Date(),
  )
  if (scenario.strictInput && current.nextInspectionMonth) {
    const due = parseRegistrationMonth(current.nextInspectionMonth)
    const start = currentMonthIndex(new Date(scenario.quote.quoteDate + 'T12:00:00'))
    if (due !== null) {
      const months: number[] = []
      for (let month = Math.max(0, due - start); month < maintenanceMonths; month += 24) months.push(month)
      currentCarInspections = { months }
    }
  }
  const maintenance = calculateMaintenance({
    comparisonMonths: maintenanceMonths,
    inspectionCost: current.inspectionCost,
    inspectionServiceCost: current.inspectionServiceCost,
    inspectionLegalCost: current.inspectionLegalCost,
    legalInspectionCost: current.legalInspectionCost,
    sixMonthInspectionCost: current.sixMonthInspectionCost,
    tireCost: current.tireCost,
    annualTax: current.annualTax,
    monthlyInsurance: current.monthlyInsurance,
    tireCycleYears: Number(current.tireCycleYears) || 4,
    includeInsurance: true,
    repairCost: current.repairCost,
    vehicleCondition: 'used',
    nextInspectionMonths: '',
    inspectionMonthsOverride: currentCarInspections.months,
    inspectionCycleLabel: scenario.strictInput && current.nextInspectionMonth ? '登録済み次回車検・以後2年ごと' : '初度登録から3年目・以後2年ごと',
    inspectionWarning: currentCarInspections.warning,
  })
  const totalPayment = originalPurchasePrice + futureLoanPayment
  const effectiveTotal = totalPayment + maintenance.total
  const maintenanceMonthly = effectiveMonthly(maintenance.total, maintenanceMonths)
  const futurePaymentMonthly = monthlyPayment > 0
    ? monthlyPayment
    : effectiveMonthly(remainingDebt, maintenanceMonths)
  const statusQuoEffectiveMonthly = futurePaymentMonthly + maintenanceMonthly
  const warnings = [...maintenance.warnings]
  const complete = visibility.showInDetailComparison && !currentCarInspections.warning

  if (remainingDebt > 0 && scheduledRemaining > 0 && scheduledRemaining < remainingDebt) {
    warnings.push('残り支払予定額が残債を下回っています。月額と残り回数を確認してください。')
  }

  return createPlanResult(scenario, maintenance, {
    planId: 'statusQuo',
    label: '現状維持',
    isVisible: visibility.showInDetailComparison,
    isComplete: complete,
    totalPayment,
    effectiveTotal,
    effectiveMonthlyOverride: statusQuoEffectiveMonthly,
    maintenanceYears: current.currentMaintenanceYears,
    priceBasis: 'current',
    priceBasisAmount: originalPurchasePrice,
    hasRequiredPrice: visibility.showInDetailComparison,
    initialPayment: originalPurchasePrice,
    monthlyPayment,
    secondAndLaterMonthlyPayment: monthlyPayment,
    paymentCount: remainingPayments,
    includedItems: ['過去の購入額', '残りローン支払', '維持費'],
    warnings,
    breakdown: {
      vehiclePrice: originalPurchasePrice,
      tradeIn: 0,
      principal: futureLoanPayment,
      totalPayment,
      effectiveTotal,
    },
  })
}
