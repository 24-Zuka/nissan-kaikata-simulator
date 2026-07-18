import { calculateBvc } from './bvc'
import { calculateCash } from './cash'
import { calculateCredit } from './credit'
import { calculateOmatome } from './omatome'
import { getVehicleAmounts } from './planHelpers'
import { calculateStatusQuo } from './statusQuo'
import type { ComparisonResult, PlanResult, Scenario } from './types'
import { validateScenario } from './validation'

export function calculateComparison(scenario: Scenario): ComparisonResult {
  const newVehicle = getVehicleAmounts(scenario, 'new')
  const cashCreditPriceBasis = scenario.vehicle.condition === 'used' ? 'used' : 'new'
  const cashCreditVehicle = getVehicleAmounts(scenario, cashCreditPriceBasis)
  const statusQuo = calculateStatusQuo(scenario)
  const cash = calculateCash(scenario)
  const credit = calculateCredit(scenario)
  const bvc = calculateBvc(scenario)
  const omatome = calculateOmatome(scenario)
  const plans: PlanResult[] = [statusQuo, cash, credit, bvc, omatome]
  for (const plan of plans) {
    if (plan.planId !== 'statusQuo') {
      plan.isVisible = scenario.comparison.enabledPlans[plan.planId]
    }
  }
  const statusQuoTotal = statusQuo.isVisible ? statusQuo.effectiveTotal : undefined

  for (const plan of plans) {
    if (statusQuoTotal !== undefined && plan.planId !== 'statusQuo') {
      plan.differenceFromStatusQuo = plan.effectiveTotal - statusQuoTotal
    }
  }

  const visiblePlans = plans.filter((plan) => plan.isVisible)
  const validationIssues = validateScenario(scenario, plans)

  return {
    scenario,
    newVehicleEstimateTotal: newVehicle.newVehicleEstimateTotal,
    usedCarPurchasePrice: cashCreditVehicle.usedCarPurchasePrice,
    newVehicleTradeInDeduction: newVehicle.tradeIn,
    newVehiclePurchaseAmount: newVehicle.purchaseAmount,
    cashCreditPriceBasis,
    cashCreditTradeInDeduction: cashCreditVehicle.tradeIn,
    cashCreditPurchaseAmount: cashCreditVehicle.purchaseAmount,
    plans,
    visiblePlanCount: visiblePlans.length,
    completePlans: visiblePlans.filter((plan) => plan.isComplete),
    incompletePlans: visiblePlans.filter((plan) => !plan.isComplete),
    validationIssues,
    bvc,
    omatome,
    warnings: plans.flatMap((plan) => plan.maintenance.warnings),
  }
}
