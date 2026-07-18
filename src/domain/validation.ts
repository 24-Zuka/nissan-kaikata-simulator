import type {
  PlanResult,
  PurchasablePlanId,
  Scenario,
  ScenarioValidationIssue,
} from './types'

function issue(
  sectionId: ScenarioValidationIssue['sectionId'],
  fieldId: string,
  message: string,
  planId?: ScenarioValidationIssue['planId'],
): ScenarioValidationIssue {
  return { sectionId, fieldId, planId, message, severity: 'error' }
}

export function validateScenario(
  scenario: Scenario,
  plans: PlanResult[],
): ScenarioValidationIssue[] {
  const issues: ScenarioValidationIssue[] = []
  const enabled = scenario.comparison.enabledPlans
  const enabledIds = (Object.keys(enabled) as PurchasablePlanId[])
    .filter((planId) => enabled[planId])

  if (!scenario.quote.scenarioName.trim()) {
    issues.push(issue('quote', 'scenarioName', '案件名を入力してください。'))
  }
  if (enabledIds.length === 0) {
    issues.push(issue('vehicle', 'enabledPlans', '比較する購入プランを1つ以上選択してください。'))
  }
  if (enabledIds.length > 0 && scenario.vehicle.estimateTotal === '') {
    issues.push(issue('vehicle', 'estimateTotal', '新車見積総額を入力してください。'))
  }
  if (
    scenario.vehicle.condition === 'used'
    && (enabled.cash || enabled.credit)
    && scenario.vehicle.usedCarPurchasePrice === ''
  ) {
    issues.push(issue('vehicle', 'usedCarPurchasePrice', '中古車購入価格を入力してください。'))
  }

  const statusQuo = plans.find((plan) => plan.planId === 'statusQuo')
  if (statusQuo?.isVisible && !statusQuo.isComplete) {
    issues.push(issue(
      'currentCar',
      'firstRegistrationMonth',
      statusQuo.warnings.find((warning) => warning.includes('初度登録年月'))
        || '現在の車の初度登録年月を確認してください。',
      'statusQuo',
    ))
  }

  for (const plan of plans) {
    if (plan.planId === 'statusQuo' || !enabled[plan.planId]) continue
    if (plan.isComplete) continue
    const fieldId = plan.planId === 'bvc'
      ? 'residualValue'
      : plan.planId === 'omatome'
        ? 'monthlyPayment'
        : plan.planId === 'credit'
          ? 'payment'
          : 'estimateTotal'
    issues.push(issue(
      plan.planId,
      fieldId,
      plan.warnings[0] || `${plan.label}の入力内容を確認してください。`,
      plan.planId,
    ))
  }

  return issues
}
