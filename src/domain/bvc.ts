import { normalizeYen } from './money'
import {
  calculateManualPaymentSchedule,
  calculatePaymentSchedule,
  hasManualPaymentInput,
} from './payment'
import { calculateScenarioMaintenance } from './maintenance'
import { createPlanResult, getVehicleAmounts } from './planHelpers'
import {
  BVC_PAYMENT_COUNTS,
  normalizePaymentCount,
  normalizePurchaseMaintenanceYears,
  paymentCountToYears,
} from './planTerms'
import type {
  BvcPlanResult,
  MaintenanceResult,
  PlanResult,
  Scenario,
} from './types'

function limitReturnInspection(maintenance: MaintenanceResult): MaintenanceResult {
  const inspection = maintenance.breakdown.find((item) => item.id === 'inspection')!
  if (inspection.count <= 1) return maintenance
  const inspectionTotal = inspection.unitCost
  const breakdown = maintenance.breakdown.map((item) => item.id === 'inspection'
    ? { ...item, count: 1, total: inspectionTotal }
    : item)
  return {
    ...maintenance,
    inspectionMonths: maintenance.inspectionMonths.slice(0, 1),
    inspectionCost: inspectionTotal,
    total: breakdown.reduce((sum, item) => sum + item.total, 0),
    breakdown,
  }
}

export function calculateBvc(scenario: Scenario): BvcPlanResult {
  const vehicle = getVehicleAmounts(scenario, 'new')
  const paymentCount = normalizePaymentCount(
    scenario.bvc.paymentCount,
    BVC_PAYMENT_COUNTS,
  )
  const returnYears = paymentCountToYears(paymentCount)
  const purchaseYears = normalizePurchaseMaintenanceYears(
    scenario.bvc.bvcMaintenanceYears,
    returnYears,
  )
  const returnMaintenance = limitReturnInspection(calculateScenarioMaintenance(
    scenario,
    returnYears,
    'new',
  ))
  const purchaseMaintenance = calculateScenarioMaintenance(scenario, purchaseYears, 'new')
  const downPayment = Math.min(
    normalizeYen(scenario.bvc.downPayment),
    vehicle.purchaseAmount,
  )
  const principal = Math.max(0, vehicle.purchaseAmount - downPayment)
  const residualValue = Math.min(normalizeYen(scenario.bvc.residualValue), principal)
  const regularPaymentCount = Math.max(0, paymentCount - 1)
  const manualPayment = hasManualPaymentInput(
    scenario.bvc.firstPayment,
    scenario.bvc.monthlyPayment,
  )
  const scheduleInput = {
    principal,
    annualRate: scenario.bvc.annualRate,
    paymentCount,
    regularPaymentCount,
    bonusPayment: scenario.bvc.bonusPayment,
    residualValue,
  }
  const schedule = manualPayment
    ? calculateManualPaymentSchedule({
        ...scheduleInput,
        firstPayment: scenario.bvc.firstPayment,
        monthlyPayment: scenario.bvc.monthlyPayment,
      })
    : calculatePaymentSchedule(scheduleInput)
  const installmentsWithoutResidual = Math.max(0, schedule.totalPayment - residualValue)
  const returnTotal = downPayment + installmentsWithoutResidual
  const purchaseTotal = downPayment + schedule.totalPayment
  const complete =
    vehicle.hasRequiredPrice &&
    paymentCount > 1 &&
    residualValue > 0 &&
    (manualPayment
      ? scenario.bvc.monthlyPayment !== '' && schedule.totalPayment >= principal
      : scenario.bvc.annualRate !== '')
  const commonWarnings = [
    ...(complete ? [] : [manualPayment
      ? '車両価格・入力支払額・支払回数・残価を確認してください。'
      : '車両価格・金利・支払回数・残価を確認してください。']),
    ...schedule.warnings,
  ]

  const createModeResult = (
    mode: 'return' | 'purchase',
    totalPayment: number,
    maintenance: MaintenanceResult,
    maintenanceYears: number,
  ): PlanResult =>
    createPlanResult(scenario, maintenance, {
      planId: 'bvc',
      label: 'BVC',
      isComplete: complete,
      totalPayment,
      effectiveTotal: totalPayment + maintenance.total,
      maintenanceYears,
      selectedMode: mode,
      priceBasis: 'new',
      priceBasisAmount: vehicle.vehiclePrice,
      hasRequiredPrice: vehicle.hasRequiredPrice,
      initialPayment: downPayment + schedule.firstPayment,
      monthlyPayment: schedule.secondAndLaterMonthlyPayment,
      secondAndLaterMonthlyPayment: schedule.secondAndLaterMonthlyPayment,
      finalPayment: mode === 'purchase' ? residualValue : 0,
      bonusPayment: schedule.bonusPayment,
      bonusPaymentCount: schedule.bonusPaymentCount,
      paymentCount,
      residualValue,
      interestFee: schedule.interestFee,
      includedItems: ['車両購入費用', '金利手数料'],
      excludedItems: [
        '維持費',
        ...(mode === 'return' ? ['返却時の最終回支払'] : []),
      ],
      warnings: commonWarnings,
      breakdown: {
        vehiclePrice: vehicle.vehiclePrice,
        tradeIn: vehicle.tradeIn,
        principal,
        downPayment,
        interestFee: schedule.interestFee,
        residualValue,
        totalPayment,
        effectiveTotal: totalPayment + maintenance.total,
      },
    })

  const returnResult = createModeResult(
    'return',
    returnTotal,
    returnMaintenance,
    returnYears,
  )
  const purchaseResult = createModeResult(
    'purchase',
    purchaseTotal,
    purchaseMaintenance,
    purchaseYears,
  )
  const selected =
    scenario.bvc.selectedMode === 'purchase' ? purchaseResult : returnResult

  return {
    ...selected,
    selectedMode: scenario.bvc.selectedMode,
    returnResult,
    purchaseResult,
  }
}
