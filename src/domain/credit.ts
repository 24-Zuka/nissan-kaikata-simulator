import { normalizeYen } from './money'
import {
  calculateManualPaymentSchedule,
  calculatePaymentSchedule,
  hasManualPaymentInput,
} from './payment'
import { calculateScenarioMaintenance } from './maintenance'
import { createPlanResult, getVehicleAmounts } from './planHelpers'
import type { PlanResult, Scenario } from './types'

export function calculateCredit(scenario: Scenario): PlanResult {
  const priceBasis = scenario.vehicle.condition === 'used' ? 'used' : 'new'
  const vehicle = getVehicleAmounts(scenario, priceBasis)
  const maintenance = calculateScenarioMaintenance(
    scenario,
    scenario.credit.creditMaintenanceYears,
  )
  const downPayment = Math.min(
    normalizeYen(scenario.credit.downPayment),
    vehicle.purchaseAmount,
  )
  const principal = Math.max(0, vehicle.purchaseAmount - downPayment)
  const manualPayment = hasManualPaymentInput(
    scenario.credit.firstPayment,
    scenario.credit.monthlyPayment,
  )
  const scheduleInput = {
    principal,
    annualRate: scenario.credit.annualRate,
    paymentCount: scenario.credit.paymentCount,
    bonusPayment: scenario.credit.bonusPayment,
  }
  const schedule = manualPayment
    ? calculateManualPaymentSchedule({
        ...scheduleInput,
        firstPayment: scenario.credit.firstPayment,
        monthlyPayment: scenario.credit.monthlyPayment,
      })
    : calculatePaymentSchedule(scheduleInput)
  const totalPayment = downPayment + schedule.totalPayment
  const effectiveTotal = totalPayment + maintenance.total
  const complete = vehicle.hasRequiredPrice
    && scenario.credit.paymentCount > 0
    && (manualPayment
      ? scenario.credit.monthlyPayment !== '' && schedule.totalPayment >= principal
      : scenario.credit.annualRate !== '')

  return createPlanResult(scenario, maintenance, {
    planId: 'credit',
    label: 'クレジット',
    isComplete: complete,
    totalPayment,
    effectiveTotal,
    maintenanceYears: scenario.credit.creditMaintenanceYears,
    priceBasis,
    priceBasisAmount: vehicle.vehiclePrice,
    hasRequiredPrice: vehicle.hasRequiredPrice,
    initialPayment: downPayment + schedule.firstPayment,
    monthlyPayment: schedule.secondAndLaterMonthlyPayment,
    secondAndLaterMonthlyPayment: schedule.secondAndLaterMonthlyPayment,
    bonusPayment: schedule.bonusPayment,
    bonusPaymentCount: schedule.bonusPaymentCount,
    paymentCount: schedule.regularPaymentCount,
    interestFee: schedule.interestFee,
    includedItems: ['車両購入費用', '金利手数料'],
    excludedItems: ['維持費'],
    warnings: [
      ...(complete ? [] : [manualPayment
        ? '車両価格・入力支払額・支払回数を確認してください。'
        : priceBasis === 'used'
          ? '中古車購入価格・金利・支払回数を確認してください。'
          : '車両見積総額・金利・支払回数を確認してください。']),
      ...schedule.warnings,
    ],
    breakdown: {
      vehiclePrice: vehicle.vehiclePrice,
      tradeIn: vehicle.tradeIn,
      principal,
      downPayment,
      interestFee: schedule.interestFee,
      totalPayment,
      effectiveTotal,
    },
  })
}
