/**
 * プラン計算の共通ヘルパー（純粋関数）。
 */

import type { PlanBreakdown } from './types'
import type { VehicleEstimate } from './estimate'
import type { MaintenanceResult } from './maintenance'
import { Decimal, roundYen } from './money'

/** 各プラン計算に共通で渡すコンテキスト（scenario.ts が生成）。 */
export type PlanContext = {
  estimate: VehicleEstimate
  maintenance: MaintenanceResult
  /** 実質月額の割り基準（= simulationYears × 12）。 */
  comparisonMonths: number
}

/** 0埋めの内訳を生成し、partialで上書きする。 */
export function createBreakdown(partial: Partial<PlanBreakdown> = {}): PlanBreakdown {
  return {
    vehiclePrice: 0,
    optionPrice: 0,
    taxAndFees: 0,
    discount: 0,
    tradeIn: 0,
    principal: 0,
    downPayment: 0,
    inspectionCost: 0,
    legalInspectionCost: 0,
    sixMonthInspectionCost: 0,
    maintenanceCost: 0,
    tireCost: 0,
    taxCost: 0,
    insuranceCost: 0,
    omatomeIncludedCost: 0,
    omatomeExcludedCost: 0,
    interestFee: 0,
    residualValue: 0,
    totalPayment: 0,
    effectiveTotal: 0,
    effectiveMonthly: 0,
    ...partial,
  }
}

/** 実質月額 = round(実質総額 / 比較月数)。比較月数<=0 は 0。 */
export function effectiveMonthlyOf(effectiveTotal: number, comparisonMonths: number): number {
  if (comparisonMonths <= 0) return 0
  return roundYen(new Decimal(effectiveTotal).div(comparisonMonths))
}
