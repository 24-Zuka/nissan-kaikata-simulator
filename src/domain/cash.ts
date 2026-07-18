import { calculateScenarioMaintenance } from './maintenance'
import { createPlanResult, effectiveMonthly, getVehicleAmounts } from './planHelpers'
import type { PlanResult, Scenario } from './types'

export function calculateCash(scenario: Scenario): PlanResult {
  const priceBasis = scenario.vehicle.condition === 'used' ? 'used' : 'new'
  const vehicle = getVehicleAmounts(scenario, priceBasis)
  const maintenance = calculateScenarioMaintenance(
    scenario,
    scenario.cash.cashMaintenanceYears,
  )
  const totalPayment = vehicle.purchaseAmount
  const effectiveTotal = totalPayment + maintenance.total
  const complete = vehicle.hasRequiredPrice

  return createPlanResult(scenario, maintenance, {
    planId: 'cash',
    label: '現金一括',
    isComplete: complete,
    totalPayment,
    effectiveTotal,
    maintenanceYears: scenario.cash.cashMaintenanceYears,
    priceBasis,
    priceBasisAmount: vehicle.vehiclePrice,
    hasRequiredPrice: vehicle.hasRequiredPrice,
    monthlyEquivalent: effectiveMonthly(totalPayment, maintenance.months),
    initialPayment: 0,
    monthlyPayment: 0,
    paymentCount: 0,
    includedItems: ['車両購入費用'],
    excludedItems: ['維持費'],
    warnings: complete
      ? []
      : [priceBasis === 'used' ? '中古車購入価格を入力してください。' : '車両見積総額を入力してください。'],
    breakdown: {
      vehiclePrice: vehicle.vehiclePrice,
      tradeIn: vehicle.tradeIn,
      principal: totalPayment,
      totalPayment,
      effectiveTotal,
    },
  })
}
