import { normalizeYen } from './money'
import { calculateScenarioMaintenance } from './maintenance'
import { createPlanResult, getVehicleAmounts } from './planHelpers'
import {
  normalizePaymentCount,
  normalizePurchaseMaintenanceYears,
  OMATOME_PAYMENT_COUNTS,
  paymentCountToYears,
} from './planTerms'
import type {
  MaintenanceCoverage,
  MaintenanceResult,
  OmatomePlanResult,
  PlanResult,
  Scenario,
} from './types'

function createMaintenanceCoverage(
  maintenance: MaintenanceResult,
  coveredMaintenance: MaintenanceResult,
  includeInsurance: boolean,
): MaintenanceCoverage {
  const coveredById = new Map(
    coveredMaintenance.breakdown.map((item) => [item.id, item]),
  )
  const items = maintenance.breakdown.map((item) => {
    const canBeIncluded = item.id !== 'repair'
      && (item.id !== 'insurance' || includeInsurance)
    const includedCost = canBeIncluded
      ? Math.min(item.total, coveredById.get(item.id)?.total ?? 0)
      : 0
    return {
      id: item.id,
      includedCost,
      customerCost: Math.max(0, item.total - includedCost),
    }
  })
  return {
    includedThroughMonths: coveredMaintenance.months,
    includedCost: items.reduce((sum, item) => sum + item.includedCost, 0),
    customerCost: items.reduce((sum, item) => sum + item.customerCost, 0),
    items,
  }
}

export function calculateOmatome(scenario: Scenario): OmatomePlanResult {
  const vehicle = getVehicleAmounts(scenario, 'new')
  const input = scenario.omatome
  const paymentCount = normalizePaymentCount(
    input.paymentCount,
    OMATOME_PAYMENT_COUNTS,
  )
  const returnYears = paymentCountToYears(paymentCount)
  const purchaseYears = normalizePurchaseMaintenanceYears(
    input.omatomeMaintenanceYears,
    returnYears,
  )
  const coveredMaintenance = calculateScenarioMaintenance(
    scenario,
    returnYears,
    'new',
  )
  const bonusPaymentCount = Math.floor(paymentCount / 6)
  const downPayment = normalizeYen(input.downPayment)
  const firstPayment = normalizeYen(input.firstPayment)
  const monthlyPayment = normalizeYen(input.monthlyPayment)
  const bonusPayment = normalizeYen(input.bonusPayment)
  const finalPayment = normalizeYen(input.finalPayment)
  const regularTotal =
    paymentCount > 0
      ? firstPayment + monthlyPayment * Math.max(0, paymentCount - 1)
      : 0
  const regularPaymentTotal =
    downPayment +
    regularTotal +
    bonusPayment * bonusPaymentCount
  const complete = vehicle.hasRequiredPrice
    && regularPaymentTotal > 0
    && paymentCount > 0
    && finalPayment > 0

  const createModeResult = (
    mode: 'return' | 'purchase',
    maintenance: MaintenanceResult,
    maintenanceYears: number,
  ): PlanResult => {
    const coverage = createMaintenanceCoverage(
      maintenance,
      coveredMaintenance,
      input.included.insurance,
    )
    const totalPayment = regularPaymentTotal + (mode === 'purchase' ? finalPayment : 0)
    const effectiveTotal = totalPayment + coverage.customerCost
    const includedIds = new Set(
      coverage.items.filter((item) => item.includedCost > 0).map((item) => item.id),
    )
    const excludedIds = new Set(
      coverage.items.filter((item) => item.customerCost > 0).map((item) => item.id),
    )
    return createPlanResult(scenario, maintenance, {
      planId: 'omatome',
      label: 'おまとめプラン',
      isComplete: complete,
      totalPayment,
      effectiveTotal,
      maintenanceYears,
      selectedMode: mode,
      maintenanceCoverage: coverage,
      priceBasis: 'new',
      priceBasisAmount: vehicle.vehiclePrice,
      hasRequiredPrice: vehicle.hasRequiredPrice,
      initialPayment: downPayment + firstPayment,
      monthlyPayment,
      secondAndLaterMonthlyPayment: monthlyPayment,
      finalPayment: mode === 'purchase' ? finalPayment : 0,
      bonusPayment,
      bonusPaymentCount,
      paymentCount,
      includedItems: [
        '車両購入費用',
        ...maintenance.breakdown
          .filter((item) => includedIds.has(item.id))
          .map((item) => item.label),
      ],
      excludedItems: maintenance.breakdown
        .filter((item) => excludedIds.has(item.id))
        .map((item) => item.label),
      warnings: complete
        ? []
        : ['実見積の支払額・支払回数・最終回支払を入力してください。'],
      breakdown: {
        vehiclePrice: vehicle.vehiclePrice,
        tradeIn: vehicle.tradeIn,
        principal: Math.max(0, vehicle.purchaseAmount - downPayment),
        downPayment,
        omatomeIncludedCost: coverage.includedCost,
        omatomeExcludedCost: coverage.customerCost,
        omatomeReflectedCost: coverage.customerCost,
        totalPayment,
        effectiveTotal,
      },
    })
  }

  const returnResult = createModeResult('return', coveredMaintenance, returnYears)
  const purchaseMaintenance = calculateScenarioMaintenance(scenario, purchaseYears, 'new')
  const purchaseResult = createModeResult('purchase', purchaseMaintenance, purchaseYears)
  const selected = input.selectedMode === 'purchase' ? purchaseResult : returnResult

  return {
    ...selected,
    selectedMode: input.selectedMode,
    returnResult,
    purchaseResult,
  }
}
