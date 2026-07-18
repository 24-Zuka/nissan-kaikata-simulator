import { afterEach, describe, expect, it, vi } from 'vitest'
import { calculateComparison } from './comparison'
import { createInitialScenario } from './defaults'
import { calculatePaymentSchedule } from './payment'
import { getStatusQuoVisibility } from './statusQuo'

afterEach(() => {
  vi.useRealTimers()
})

function completeScenario() {
  const scenario = createInitialScenario()
  scenario.vehicle.estimateTotal = 3_400_000
  scenario.vehicle.tradeIn = 500_000
  scenario.credit.downPayment = 300_000
  scenario.credit.bonusPayment = 50_000
  scenario.bvc.downPayment = 300_000
  scenario.bvc.residualValue = 1_200_000
  scenario.bvc.bonusPayment = 30_000
  scenario.omatome.downPayment = 300_000
  scenario.omatome.firstPayment = 45_000
  scenario.omatome.monthlyPayment = 45_000
  scenario.omatome.bonusPayment = 50_000
  scenario.omatome.finalPayment = 0
  return scenario
}

describe('calculateComparison', () => {
  it('caps trade-in and never deducts it twice', () => {
    const scenario = completeScenario()
    scenario.vehicle.tradeIn = 9_000_000
    const result = calculateComparison(scenario)
    const cash = result.plans.find((plan) => plan.planId === 'cash')

    expect(result.cashCreditTradeInDeduction).toBe(result.newVehicleEstimateTotal)
    expect(result.cashCreditPurchaseAmount).toBe(0)
    expect(cash?.totalPayment).toBe(0)
    expect(cash?.effectiveTotal).toBe(cash?.maintenance.total)
  })

  it('uses the used-car purchase price only for cash and credit', () => {
    const scenario = completeScenario()
    scenario.vehicle.condition = 'used'
    scenario.vehicle.estimateTotal = 5_000_000
    scenario.vehicle.usedCarPurchasePrice = 2_800_000
    scenario.vehicle.tradeIn = 500_000
    scenario.vehicle.nextInspectionMonths = 12
    scenario.credit.downPayment = 0
    const result = calculateComparison(scenario)
    const cash = result.plans.find((plan) => plan.planId === 'cash')!
    const credit = result.plans.find((plan) => plan.planId === 'credit')!
    const bvc = result.plans.find((plan) => plan.planId === 'bvc')!
    const omatome = result.plans.find((plan) => plan.planId === 'omatome')!

    expect(result.usedCarPurchasePrice).toBe(2_800_000)
    expect(result.cashCreditPurchaseAmount).toBe(2_300_000)
    expect(cash.totalPayment).toBe(2_300_000)
    expect(credit.breakdown.principal).toBe(2_300_000)
    expect(cash.priceBasis).toBe('used')
    expect(credit.priceBasis).toBe('used')
    expect(bvc.priceBasis).toBe('new')
    expect(bvc.breakdown.vehiclePrice).toBe(5_000_000)
    expect(bvc.breakdown.tradeIn).toBe(500_000)
    expect(omatome.priceBasis).toBe('new')
    expect(bvc.maintenance.inspectionMonths[0]).toBe(36)
    expect(omatome.maintenance.inspectionMonths[0]).toBe(36)
  })

  it('does not fall back to the new-car estimate when the used price is blank', () => {
    const scenario = completeScenario()
    scenario.vehicle.condition = 'used'
    scenario.vehicle.estimateTotal = 5_000_000
    scenario.vehicle.usedCarPurchasePrice = ''
    const result = calculateComparison(scenario)
    const cash = result.plans.find((plan) => plan.planId === 'cash')!
    const credit = result.plans.find((plan) => plan.planId === 'credit')!

    expect(result.cashCreditPurchaseAmount).toBe(0)
    expect(cash.totalPayment).toBe(0)
    expect(cash.hasRequiredPrice).toBe(false)
    expect(credit.breakdown.principal).toBe(0)
    expect(credit.hasRequiredPrice).toBe(false)
    expect(cash.warnings).toContain('中古車購入価格を入力してください。')
  })

  it('keeps status quo hidden until a meaningful current-car value exists', () => {
    const scenario = completeScenario()
    expect(getStatusQuoVisibility(scenario.currentCar).showInPrintComparison).toBe(false)

    scenario.currentCar.monthlyPayment = 30_000
    expect(getStatusQuoVisibility(scenario.currentCar).showInPrintComparison).toBe(true)

    scenario.currentCar.monthlyPayment = ''
    scenario.currentCar.remainingDebt = 600_000
    expect(getStatusQuoVisibility(scenario.currentCar).showInPrintComparison).toBe(true)
  })

  it('uses cumulative status-quo burden without counting debt twice', () => {
    const scenario = completeScenario()
    scenario.currentCar.originalPurchasePrice = 2_000_000
    scenario.currentCar.monthlyPayment = 30_000
    scenario.currentCar.remainingPayments = 10
    scenario.currentCar.remainingDebt = 500_000
    scenario.currentCar.firstRegistrationMonth = '2021-07'
    scenario.currentCar.annualTax = 36_000
    const result = calculateComparison(scenario)
    const statusQuo = result.plans[0]

    expect(statusQuo.totalPayment).toBe(2_300_000)
    expect(statusQuo.effectiveTotal).toBeGreaterThan(statusQuo.totalPayment)
  })

  it('uses only future payment and maintenance for status quo effective monthly', () => {
    const scenario = completeScenario()
    scenario.currentCar.originalPurchasePrice = 2_000_000
    scenario.currentCar.currentMaintenanceYears = 5
    scenario.currentCar.firstRegistrationMonth = '2021-07'
    scenario.currentCar.monthlyPayment = 30_000
    scenario.currentCar.remainingPayments = 10
    scenario.currentCar.remainingDebt = 600_000
    let statusQuo = calculateComparison(scenario).plans[0]
    const expectedMaintenanceMonthly = Math.round(
      statusQuo.maintenance.total / statusQuo.maintenanceMonths,
    )

    expect(statusQuo.effectiveTotal).toBe(statusQuo.totalPayment + statusQuo.maintenance.total)
    expect(statusQuo.effectiveMonthly).toBe(30_000 + expectedMaintenanceMonthly)
    expect(statusQuo.breakdown.effectiveMonthly).toBe(statusQuo.effectiveMonthly)

    scenario.currentCar.monthlyPayment = ''
    statusQuo = calculateComparison(scenario).plans[0]
    expect(statusQuo.effectiveMonthly).toBe(10_000 + expectedMaintenanceMonthly)

    scenario.currentCar.remainingDebt = ''
    statusQuo = calculateComparison(scenario).plans[0]
    expect(statusQuo.effectiveMonthly).toBe(expectedMaintenanceMonthly)
  })

  it('calculates status quo inspections from the current car registration month', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 1))
    const scenario = completeScenario()
    scenario.currentCar.originalPurchasePrice = 2_000_000
    scenario.currentCar.firstRegistrationMonth = '2026-07'
    scenario.currentCar.currentMaintenanceYears = 5
    let statusQuo = calculateComparison(scenario).plans[0]

    expect(statusQuo.planId).toBe('statusQuo')
    expect(statusQuo.maintenance.inspectionMonths).toEqual([36])

    scenario.currentCar.currentMaintenanceYears = 7
    statusQuo = calculateComparison(scenario).plans[0]
    expect(statusQuo.maintenance.inspectionMonths).toEqual([36, 60])

    scenario.currentCar.currentMaintenanceYears = 9
    statusQuo = calculateComparison(scenario).plans[0]
    expect(statusQuo.maintenance.inspectionMonths).toEqual([36, 60, 84])

    scenario.currentCar.firstRegistrationMonth = '2021-07'
    scenario.currentCar.currentMaintenanceYears = 5
    statusQuo = calculateComparison(scenario).plans[0]
    expect(statusQuo.maintenance.inspectionMonths).toEqual([0, 24, 48])
  })

  it('includes current-month status quo inspections and warns when registration is missing', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 6, 1))
    const scenario = completeScenario()
    scenario.currentCar.originalPurchasePrice = 2_000_000
    scenario.currentCar.currentMaintenanceYears = 1
    scenario.currentCar.firstRegistrationMonth = '2023-07'
    let statusQuo = calculateComparison(scenario).plans[0]

    expect(statusQuo.maintenance.inspectionMonths).toEqual([0])
    expect(statusQuo.warnings).toEqual([])

    scenario.currentCar.firstRegistrationMonth = ''
    statusQuo = calculateComparison(scenario).plans[0]
    expect(statusQuo.maintenance.inspectionMonths).toEqual([])
    expect(statusQuo.isComplete).toBe(false)
    expect(statusQuo.warnings).toContain(
      '現在の車の初度登録年月が未入力のため、車検費用は計算していません。',
    )

    scenario.currentCar.firstRegistrationMonth = '2026-08'
    statusQuo = calculateComparison(scenario).plans[0]
    expect(statusQuo.maintenance.inspectionMonths).toEqual([])
    expect(statusQuo.isComplete).toBe(false)
    expect(statusQuo.warnings).toContain(
      '現在の車の初度登録年月が未来日のため、車検費用は計算していません。',
    )
  })

  it('keeps residual value as the BVC return/purchase difference', () => {
    const scenario = completeScenario()
    const result = calculateComparison(scenario)

    expect(
      result.bvc.purchaseResult.totalPayment - result.bvc.returnResult.totalPayment,
    ).toBe(1_200_000)
    expect(result.bvc.returnResult.finalPayment).toBe(0)
    expect(result.bvc.purchaseResult.finalPayment).toBe(1_200_000)

    const reducedPrincipalSchedule = calculatePaymentSchedule({
      principal: result.newVehiclePurchaseAmount - 300_000 - 1_200_000,
      annualRate: scenario.bvc.annualRate,
      paymentCount: scenario.bvc.paymentCount,
      regularPaymentCount: scenario.bvc.paymentCount - 1,
      bonusPayment: scenario.bvc.bonusPayment,
    })
    expect(result.bvc.interestFee).toBeGreaterThan(reducedPrincipalSchedule.interestFee)
  })

  it('adds only excluded maintenance to the omatome effective total', () => {
    const scenario = completeScenario()
    scenario.omatome.included = {
      inspection: true,
      legalInspection: true,
      sixMonthInspection: true,
      tires: true,
      tax: true,
      insurance: true,
    }
    const result = calculateComparison(scenario)
    const omatome = result.plans.find((plan) => plan.planId === 'omatome')!

    expect(omatome.breakdown.omatomeExcludedCost).toBe(0)
    expect(omatome.effectiveTotal).toBe(omatome.totalPayment)
  })

  it('keeps fixed omatome maintenance included and repair costs separate', () => {
    const scenario = completeScenario()
    scenario.newMaintenance.monthlyInsurance = 8_000
    scenario.newMaintenance.repairCost = 80_000
    scenario.omatome.included = {
      inspection: false,
      legalInspection: false,
      sixMonthInspection: false,
      tires: false,
      tax: false,
      insurance: false,
    }
    const omatome = calculateComparison(scenario).plans.find(
      (plan) => plan.planId === 'omatome',
    )!

    expect(omatome.breakdown.omatomeIncludedCost).toBe(
      omatome.maintenance.total
        - omatome.maintenance.insuranceCost
        - omatome.maintenance.repairCost,
    )
    expect(omatome.breakdown.omatomeExcludedCost).toBe(
      omatome.maintenance.insuranceCost + omatome.maintenance.repairCost,
    )
    expect(omatome.effectiveTotal).toBe(
      omatome.totalPayment + omatome.breakdown.omatomeExcludedCost,
    )
  })

  it('calculates maintenance and effective totals with plan-specific periods', () => {
    const scenario = completeScenario()
    scenario.cash.cashMaintenanceYears = 5
    scenario.credit.paymentCount = 36
    scenario.credit.creditMaintenanceYears = 3
    scenario.bvc.bvcMaintenanceYears = 5
    scenario.omatome.selectedMode = 'purchase'
    scenario.omatome.omatomeMaintenanceYears = 7
    const result = calculateComparison(scenario)
    const cash = result.plans.find((plan) => plan.planId === 'cash')!
    const credit = result.plans.find((plan) => plan.planId === 'credit')!
    const omatome = result.plans.find((plan) => plan.planId === 'omatome')!

    expect(cash.maintenance.months).toBe(60)
    expect(credit.maintenance.months).toBe(36)
    expect(omatome.maintenance.months).toBe(84)
    expect(new Set([cash.maintenance.total, credit.maintenance.total, omatome.maintenance.total]).size).toBe(3)
    expect(credit.effectiveTotal).toBe(credit.totalPayment + credit.maintenance.total)
  })

  it('keeps credit payment count separate from its maintenance period', () => {
    const scenario = completeScenario()
    scenario.credit.paymentCount = 36
    scenario.credit.creditMaintenanceYears = 5
    const credit = calculateComparison(scenario).plans.find(
      (plan) => plan.planId === 'credit',
    )!

    expect(credit.paymentCount).toBe(36)
    expect(credit.maintenance.months).toBe(60)
    expect(credit.effectiveMonthly).toBe(
      Math.round(credit.effectiveTotal / credit.maintenanceMonths),
    )
  })

  it('uses cash monthly equivalents without treating the payment as a down payment', () => {
    const scenario = completeScenario()
    scenario.cash.cashMaintenanceYears = 5
    const cash = calculateComparison(scenario).plans.find(
      (plan) => plan.planId === 'cash',
    )!

    expect(cash.initialPayment).toBe(0)
    expect(cash.monthlyEquivalent).toBe(Math.round(cash.totalPayment / 60))
    expect(cash.effectiveMonthly).toBe(Math.round(cash.effectiveTotal / 60))
  })

  it('clamps maintenance periods to the supported range', () => {
    const scenario = completeScenario()
    scenario.cash.cashMaintenanceYears = 0
    scenario.credit.creditMaintenanceYears = 21
    const result = calculateComparison(scenario)

    expect(result.plans.find((plan) => plan.planId === 'cash')?.maintenanceMonths).toBe(12)
    expect(result.plans.find((plan) => plan.planId === 'credit')?.maintenanceMonths).toBe(240)
  })

  it('keeps all four omatome maintenance totals explicit', () => {
    const scenario = completeScenario()
    scenario.omatome.included.insurance = false
    const omatome = calculateComparison(scenario).plans.find(
      (plan) => plan.planId === 'omatome',
    )!

    expect(omatome.breakdown.maintenanceCost).toBe(omatome.maintenance.total)
    expect(
      omatome.breakdown.omatomeIncludedCost + omatome.breakdown.omatomeExcludedCost,
    ).toBe(omatome.maintenance.total)
    expect(omatome.breakdown.omatomeReflectedCost).toBe(
      omatome.breakdown.omatomeExcludedCost,
    )
  })

  it('uses separate maintenance costs for current, new, and used plans', () => {
    const scenario = completeScenario()
    scenario.vehicle.condition = 'used'
    scenario.vehicle.usedCarPurchasePrice = 2_800_000
    scenario.currentCar.originalPurchasePrice = 1_800_000
    scenario.currentCar.repairCost = 40_000
    scenario.currentCar.inspectionCost = 70_000
    scenario.currentCar.firstRegistrationMonth = '2021-07'
    scenario.newMaintenance.repairCost = 80_000
    scenario.newMaintenance.inspectionCost = 110_000
    scenario.usedMaintenance.repairCost = 120_000
    scenario.usedMaintenance.inspectionCost = 160_000
    scenario.vehicle.nextInspectionMonths = 12
    const result = calculateComparison(scenario)
    const statusQuo = result.plans.find((plan) => plan.planId === 'statusQuo')!
    const cash = result.plans.find((plan) => plan.planId === 'cash')!
    const credit = result.plans.find((plan) => plan.planId === 'credit')!
    const bvc = result.plans.find((plan) => plan.planId === 'bvc')!
    const omatome = result.plans.find((plan) => plan.planId === 'omatome')!

    expect(statusQuo.maintenance.repairCost).toBe(40_000)
    expect(statusQuo.breakdown.repairCost).toBe(40_000)
    expect(cash.maintenance.repairCost).toBe(120_000)
    expect(credit.maintenance.repairCost).toBe(120_000)
    expect(bvc.maintenance.repairCost).toBe(80_000)
    expect(omatome.maintenance.repairCost).toBe(80_000)
    expect(cash.maintenance.breakdown.find((item) => item.id === 'inspection')?.unitCost).toBe(160_000)
    expect(credit.maintenance.breakdown.find((item) => item.id === 'inspection')?.unitCost).toBe(160_000)
    expect(bvc.maintenance.breakdown.find((item) => item.id === 'inspection')?.unitCost).toBe(110_000)
    expect(omatome.maintenance.breakdown.find((item) => item.id === 'inspection')?.unitCost).toBe(110_000)
    expect(omatome.breakdown.omatomeExcludedCost).toBeGreaterThanOrEqual(80_000)
  })

  it.each([
    [36, 3],
    [48, 4],
    [60, 5],
  ])('links BVC return %i payments to %i years and one inspection', (paymentCount, years) => {
    const scenario = completeScenario()
    scenario.bvc.paymentCount = paymentCount
    scenario.bvc.selectedMode = 'return'
    const result = calculateComparison(scenario).bvc

    expect(result.maintenanceYears).toBe(years)
    expect(result.paymentCount).toBe(paymentCount)
    expect(result.maintenance.inspectionMonths.length).toBeLessThanOrEqual(1)
    expect(result.selectedMode).toBe('return')
  })

  it('uses the full inspection schedule when BVC is purchased', () => {
    const scenario = completeScenario()
    scenario.bvc.selectedMode = 'purchase'
    scenario.bvc.bvcMaintenanceYears = 7
    const result = calculateComparison(scenario).bvc

    expect(result.maintenance.inspectionMonths).toEqual([36, 60])
    expect(result.finalPayment).toBe(scenario.bvc.residualValue)
  })

  it.each([
    [36, 3],
    [60, 5],
    [84, 7],
  ])('links omatome return %i payments to %i years', (paymentCount, years) => {
    const scenario = completeScenario()
    scenario.omatome.paymentCount = paymentCount
    scenario.omatome.selectedMode = 'return'
    const result = calculateComparison(scenario).omatome

    expect(result.maintenanceYears).toBe(years)
    expect(result.paymentCount).toBe(paymentCount)
    expect(result.finalPayment).toBe(0)
    expect(result.selectedMode).toBe('return')
  })

  it('treats the omatome final payment as a separate purchase-only payment', () => {
    const scenario = completeScenario()
    scenario.omatome.paymentCount = 36
    scenario.omatome.downPayment = 200_000
    scenario.omatome.firstPayment = 55_000
    scenario.omatome.monthlyPayment = 45_000
    scenario.omatome.bonusPayment = 60_000
    scenario.omatome.finalPayment = 900_000
    const result = calculateComparison(scenario).omatome
    const regularTotal = 200_000 + 55_000 + 45_000 * 35 + 60_000 * 6

    expect(result.returnResult.paymentCount).toBe(36)
    expect(result.returnResult.totalPayment).toBe(regularTotal)
    expect(result.purchaseResult.totalPayment).toBe(regularTotal + 900_000)
    expect(result.purchaseResult.finalPayment).toBe(900_000)
  })

  it('charges only post-term covered maintenance and repairs after omatome purchase', () => {
    const scenario = completeScenario()
    scenario.omatome.paymentCount = 60
    scenario.omatome.selectedMode = 'purchase'
    scenario.omatome.omatomeMaintenanceYears = 7
    scenario.omatome.included.insurance = true
    scenario.newMaintenance.monthlyInsurance = 8_000
    scenario.newMaintenance.repairCost = 80_000
    const result = calculateComparison(scenario).omatome
    const covered = result.maintenanceCoverage

    expect(covered.includedThroughMonths).toBe(60)
    expect(covered.items.find((item) => item.id === 'repair')).toEqual({
      id: 'repair',
      includedCost: 0,
      customerCost: 80_000,
    })
    expect(covered.items.find((item) => item.id === 'insurance')?.customerCost).toBe(
      8_000 * 24,
    )
    expect(covered.customerCost).toBeGreaterThan(80_000 + 8_000 * 24)
    expect(result.effectiveTotal).toBe(result.totalPayment + covered.customerCost)
  })

  it('uses entered credit payments instead of the interest-rate calculation', () => {
    const scenario = completeScenario()
    scenario.credit.firstPayment = 55_000
    scenario.credit.monthlyPayment = 45_000
    scenario.credit.paymentCount = 60
    scenario.credit.bonusPayment = 50_000
    const expectedTotal = 300_000 + 55_000 + 45_000 * 59 + 50_000 * 10
    const first = calculateComparison(scenario).plans.find(
      (plan) => plan.planId === 'credit',
    )!

    scenario.credit.annualRate = 99
    const afterRateChange = calculateComparison(scenario).plans.find(
      (plan) => plan.planId === 'credit',
    )!

    expect(first.totalPayment).toBe(expectedTotal)
    expect(first.initialPayment).toBe(355_000)
    expect(first.monthlyPayment).toBe(45_000)
    expect(first.bonusPaymentCount).toBe(10)
    expect(first.interestFee).toBe(expectedTotal - 2_900_000)
    expect(afterRateChange.totalPayment).toBe(first.totalPayment)
    expect(afterRateChange.interestFee).toBe(first.interestFee)
  })

  it('uses the monthly payment for the first credit payment when it is blank', () => {
    const scenario = completeScenario()
    scenario.credit.firstPayment = ''
    scenario.credit.monthlyPayment = 45_000
    scenario.credit.bonusPayment = 0
    const credit = calculateComparison(scenario).plans.find(
      (plan) => plan.planId === 'credit',
    )!

    expect(credit.initialPayment).toBe(345_000)
    expect(credit.totalPayment).toBe(300_000 + 45_000 * 60)
  })

  it('returns to automatic credit calculation after clearing manual payments', () => {
    const scenario = completeScenario()
    const automatic = calculateComparison(scenario).plans.find(
      (plan) => plan.planId === 'credit',
    )!
    scenario.credit.firstPayment = 55_000
    scenario.credit.monthlyPayment = 45_000
    expect(calculateComparison(scenario).plans.find(
      (plan) => plan.planId === 'credit',
    )?.totalPayment).not.toBe(automatic.totalPayment)

    scenario.credit.firstPayment = ''
    scenario.credit.monthlyPayment = ''
    expect(calculateComparison(scenario).plans.find(
      (plan) => plan.planId === 'credit',
    )?.totalPayment).toBe(automatic.totalPayment)
  })

  it('keeps the BVC residual separate from entered regular payments', () => {
    const scenario = completeScenario()
    scenario.bvc.firstPayment = 55_000
    scenario.bvc.monthlyPayment = 45_000
    scenario.bvc.paymentCount = 60
    scenario.bvc.bonusPayment = 50_000
    const bvc = calculateComparison(scenario).bvc
    const returnTotal = 300_000 + 55_000 + 45_000 * 58 + 50_000 * 9

    expect(bvc.returnResult.totalPayment).toBe(returnTotal)
    expect(bvc.returnResult.finalPayment).toBe(0)
    expect(bvc.purchaseResult.totalPayment).toBe(returnTotal + 1_200_000)
    expect(bvc.purchaseResult.finalPayment).toBe(1_200_000)
    expect(bvc.monthlyPayment).toBe(45_000)
    expect(bvc.bonusPaymentCount).toBe(9)
  })

  it('marks first-payment-only manual input as incomplete', () => {
    const scenario = completeScenario()
    scenario.credit.firstPayment = 55_000
    scenario.credit.monthlyPayment = ''
    const credit = calculateComparison(scenario).plans.find(
      (plan) => plan.planId === 'credit',
    )!

    expect(credit.isComplete).toBe(false)
    expect(credit.warnings).toContain('2回目以降月額を入力してください。')
  })
})
