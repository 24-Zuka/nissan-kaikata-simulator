/**
 * シナリオ合成（5プランの計算を統合する純粋関数）。
 *
 * UIはこの calculateScenario の結果（ScenarioResult）を表示するだけ。
 * 画面・印刷・お客様説明モードは同一オブジェクトを参照する（再計算・再丸め禁止）。
 */

import type { Scenario, ScenarioResult } from './types'
import { calcVehicleEstimate } from './estimate'
import { calculateMaintenance } from './maintenance'
import { calculateCashPlan } from './cash'
import { calculateCreditPlan } from './credit'
import { calculateBvcPlan } from './bvc'
import { calculateOmatomePlan } from './omatome'
import { calculateStatusQuoPlan } from './statusQuo'
import { normalizeYen } from './money'
import type { PlanContext } from './planHelpers'

export function calculateScenario(scenario: Scenario): ScenarioResult {
  const estimate = calcVehicleEstimate(scenario)

  const simulationYears = Math.max(1, Math.trunc(normalizeYen(scenario.maintenance.simulationYears)) || 1)
  const comparisonMonths = simulationYears * 12

  const maintenance = calculateMaintenance(scenario.maintenance, {
    vehicleMode: scenario.vehicleMode,
    years: simulationYears,
  })

  const ctx: PlanContext = { estimate, maintenance, comparisonMonths }

  return {
    statusQuo: calculateStatusQuoPlan(scenario, ctx),
    cash: calculateCashPlan(scenario, ctx),
    credit: calculateCreditPlan(scenario, ctx),
    bvc: calculateBvcPlan(scenario, ctx),
    omatome: calculateOmatomePlan(scenario, ctx),
    comparisonMonths,
  }
}

// プラン計算関数の再エクスポート（テスト・UIから個別に使えるように）。
export { calcVehicleEstimate } from './estimate'
export { calculateMaintenance } from './maintenance'
export { calculateCashPlan } from './cash'
export { calculateCreditPlan } from './credit'
export { calculateBvcPlan, calculateBvcBoth } from './bvc'
export { calculateOmatomePlan } from './omatome'
export { calculateStatusQuoPlan } from './statusQuo'
export type { PlanContext } from './planHelpers'
