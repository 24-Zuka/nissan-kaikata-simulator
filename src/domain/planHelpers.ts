import { normalizeYen, roundYen } from './money'
import Decimal from 'decimal.js'
import { maintenanceYearsToMonths, normalizeMaintenanceYears } from './maintenance'
import type {
  MaintenanceResult,
  MaintenanceCoverage,
  PlanBreakdown,
  PlanId,
  PlanResult,
  PriceBasis,
  Scenario,
} from './types'

export function getVehicleAmounts(
  scenario: Scenario,
  priceBasis: Extract<PriceBasis, 'new' | 'used'> = 'new',
) {
  const newVehicleEstimateTotal = normalizeYen(scenario.vehicle.estimateTotal)
  const usedCarPurchasePrice = normalizeYen(scenario.vehicle.usedCarPurchasePrice)
  const vehiclePrice = priceBasis === 'used'
    ? usedCarPurchasePrice
    : newVehicleEstimateTotal
  const tradeIn = Math.min(normalizeYen(scenario.vehicle.tradeIn), vehiclePrice)
  const purchaseAmount = vehiclePrice - tradeIn

  return {
    priceBasis,
    vehiclePrice,
    newVehicleEstimateTotal,
    usedCarPurchasePrice,
    tradeIn,
    purchaseAmount,
    hasRequiredPrice: vehiclePrice > 0,
  }
}

export function effectiveMonthly(total: number, months: number): number {
  if (months <= 0) return 0
  return roundYen(new Decimal(total).div(months))
}

export function createBreakdown(
  scenario: Scenario,
  maintenance: MaintenanceResult,
  maintenanceMonths: number,
  priceBasis: PriceBasis,
  values: Partial<PlanBreakdown>,
): PlanBreakdown {
  const vehicle = getVehicleAmounts(
    scenario,
    priceBasis === 'used' ? 'used' : 'new',
  )
  const effectiveTotal = normalizeYen(values.effectiveTotal)

  return {
    vehiclePrice: vehicle.vehiclePrice,
    tradeIn: vehicle.tradeIn,
    principal: 0,
    downPayment: 0,
    inspectionCost: maintenance.inspectionCost,
    legalInspectionCost: maintenance.legalInspectionCost,
    sixMonthInspectionCost: maintenance.sixMonthInspectionCost,
    maintenanceCost: maintenance.total,
    tireCost: maintenance.tireCost,
    taxCost: maintenance.taxCost,
    insuranceCost: maintenance.insuranceCost,
    repairCost: maintenance.repairCost,
    omatomeIncludedCost: 0,
    omatomeExcludedCost: 0,
    omatomeReflectedCost: 0,
    interestFee: 0,
    residualValue: 0,
    totalPayment: 0,
    effectiveTotal,
    effectiveMonthly: effectiveMonthly(effectiveTotal, maintenanceMonths),
    ...values,
  }
}

export function createPlanResult(
  scenario: Scenario,
  maintenance: MaintenanceResult,
  input: {
    planId: PlanId
    label: string
    isVisible?: boolean
    isComplete?: boolean
    totalPayment: number
    effectiveTotal: number
    effectiveMonthlyOverride?: number
    maintenanceYears: number
    monthlyEquivalent?: number
    initialPayment?: number
    monthlyPayment?: number
    secondAndLaterMonthlyPayment?: number
    finalPayment?: number
    bonusPayment?: number
    bonusPaymentCount?: number
    paymentCount?: number
    residualValue?: number
    interestFee?: number
    includedItems?: string[]
    excludedItems?: string[]
    warnings?: string[]
    priceBasis?: PriceBasis
    priceBasisAmount?: number
    hasRequiredPrice?: boolean
    breakdown?: Partial<PlanBreakdown>
    maintenanceCoverage?: MaintenanceCoverage
    selectedMode?: 'return' | 'purchase'
  },
): PlanResult {
  const maintenanceYears = normalizeMaintenanceYears(input.maintenanceYears)
  const maintenanceMonths = maintenanceYearsToMonths(maintenanceYears)
  const totalPayment = normalizeYen(input.totalPayment)
  const effectiveTotal = normalizeYen(input.effectiveTotal)
  const monthly = input.effectiveMonthlyOverride === undefined
    ? effectiveMonthly(effectiveTotal, maintenanceMonths)
    : normalizeYen(input.effectiveMonthlyOverride)
  const priceBasis = input.priceBasis ?? 'new'
  const defaultVehicle = getVehicleAmounts(
    scenario,
    priceBasis === 'used' ? 'used' : 'new',
  )
  const priceBasisAmount = normalizeYen(
    input.priceBasisAmount ?? defaultVehicle.vehiclePrice,
  )
  const hasRequiredPrice = input.hasRequiredPrice ?? priceBasisAmount > 0
  const breakdown = createBreakdown(scenario, maintenance, maintenanceMonths, priceBasis, {
    totalPayment,
    effectiveTotal,
    effectiveMonthly: monthly,
    interestFee: normalizeYen(input.interestFee),
    residualValue: normalizeYen(input.residualValue),
    ...input.breakdown,
  })
  const maintenanceCoverage = input.maintenanceCoverage ?? {
    includedThroughMonths: 0,
    includedCost: 0,
    customerCost: maintenance.total,
    items: maintenance.breakdown.map((item) => ({
      id: item.id,
      includedCost: 0,
      customerCost: item.total,
    })),
  }

  return {
    planId: input.planId,
    label: input.label,
    isVisible: input.isVisible ?? true,
    isComplete: input.isComplete ?? true,
    totalPayment,
    effectiveTotal,
    effectiveMonthly: monthly,
    monthlyEquivalent: normalizeYen(input.monthlyEquivalent),
    priceBasis,
    priceBasisAmount,
    hasRequiredPrice,
    maintenanceYears,
    maintenanceMonths,
    maintenance,
    maintenanceCoverage,
    selectedMode: input.selectedMode,
    initialPayment: normalizeYen(input.initialPayment),
    monthlyPayment: normalizeYen(input.monthlyPayment),
    secondAndLaterMonthlyPayment: normalizeYen(input.secondAndLaterMonthlyPayment),
    finalPayment: normalizeYen(input.finalPayment),
    bonusPayment: normalizeYen(input.bonusPayment),
    bonusPaymentCount: Math.max(0, Math.floor(input.bonusPaymentCount ?? 0)),
    paymentCount: Math.max(0, Math.floor(input.paymentCount ?? 0)),
    residualValue: normalizeYen(input.residualValue),
    interestFee: normalizeYen(input.interestFee),
    includedItems: input.includedItems ?? [],
    excludedItems: input.excludedItems ?? [],
    breakdown,
    warnings: input.warnings ?? [],
  }
}
