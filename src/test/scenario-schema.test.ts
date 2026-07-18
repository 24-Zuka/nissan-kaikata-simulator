import { describe, expect, it } from 'vitest'
import { isValidScenario } from '../../server/scenarioSchema'
import { createInitialScenario } from '../domain/defaults'

describe('cloud scenario schema', () => {
  it('accepts a complete v11 scenario', () => {
    expect(isValidScenario(createInitialScenario())).toBe(true)
  })

  it('requires all v11 plan-selection flags', () => {
    const scenario = createInitialScenario()
    delete (scenario.comparison.enabledPlans as Partial<typeof scenario.comparison.enabledPlans>)
      .omatome
    expect(isValidScenario(scenario)).toBe(false)
  })

  it('rejects invalid field types and out-of-range periods', () => {
    const invalidType = createInitialScenario()
    invalidType.vehicle.estimateTotal = 'invalid' as unknown as number
    expect(isValidScenario(invalidType)).toBe(false)

    const invalidUsedPrice = createInitialScenario()
    invalidUsedPrice.vehicle.usedCarPurchasePrice = -1
    expect(isValidScenario(invalidUsedPrice)).toBe(false)

    const invalidYears = createInitialScenario()
    invalidYears.cash.cashMaintenanceYears = 21
    expect(isValidScenario(invalidYears)).toBe(false)
    expect(isValidScenario({ schemaVersion: 5 })).toBe(false)

    const invalidRegistrationMonth = createInitialScenario()
    invalidRegistrationMonth.currentCar.firstRegistrationMonth = '2026-13'
    expect(isValidScenario(invalidRegistrationMonth)).toBe(false)

    const invalidRepairCost = createInitialScenario()
    invalidRepairCost.usedMaintenance.repairCost = -1
    expect(isValidScenario(invalidRepairCost)).toBe(false)
  })

  it('validates manual credit and BVC payment inputs', () => {
    const scenario = createInitialScenario()
    scenario.credit.firstPayment = 55_000
    scenario.credit.monthlyPayment = 45_000
    scenario.bvc.firstPayment = 60_000
    scenario.bvc.monthlyPayment = 50_000
    expect(isValidScenario(scenario)).toBe(true)

    scenario.credit.monthlyPayment = -1
    expect(isValidScenario(scenario)).toBe(false)
  })

  it('rejects unsupported plan terms, modes, and purchase years below the term', () => {
    const invalidBvcCount = createInitialScenario()
    invalidBvcCount.bvc.paymentCount = 42
    expect(isValidScenario(invalidBvcCount)).toBe(false)

    const invalidOmatomeCount = createInitialScenario()
    invalidOmatomeCount.omatome.paymentCount = 48
    expect(isValidScenario(invalidOmatomeCount)).toBe(false)

    const invalidOmatomeYears = createInitialScenario()
    invalidOmatomeYears.omatome.paymentCount = 84
    invalidOmatomeYears.omatome.omatomeMaintenanceYears = 5
    expect(isValidScenario(invalidOmatomeYears)).toBe(false)

    const invalidMode = createInitialScenario()
    invalidMode.omatome.selectedMode = 'invalid' as 'return'
    expect(isValidScenario(invalidMode)).toBe(false)
  })
})
