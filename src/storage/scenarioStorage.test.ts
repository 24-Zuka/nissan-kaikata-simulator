import { beforeEach, describe, expect, it } from 'vitest'
import { createInitialScenario } from '../domain/defaults'
import {
  createShareSafeScenario,
  decodeSharedScenario,
  encodeSharedScenario,
  loadScenarios,
  LEGACY_STORAGE_KEY,
  saveScenario,
  STORAGE_KEY,
  V9_STORAGE_KEY,
  V10_STORAGE_KEY,
  V4_STORAGE_KEY,
  V5_STORAGE_KEY,
  V6_STORAGE_KEY,
  V7_STORAGE_KEY,
  V3_STORAGE_KEY,
} from './scenarioStorage'

describe('scenario storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('saves and restores multiple scenarios', () => {
    const first = createInitialScenario()
    first.quote.scenarioName = '見積A'
    const second = createInitialScenario()
    second.quote.scenarioName = '見積B'

    saveScenario(first)
    saveScenario(second)

    expect(loadScenarios()).toHaveLength(2)
    expect(loadScenarios().map((item) => item.name)).toEqual(['見積B', '見積A'])
  })

  it('falls back safely from invalid JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not-json')
    expect(loadScenarios()).toEqual([])
  })

  it('removes personal names from shared data', () => {
    const scenario = createInitialScenario()
    scenario.quote.customerName = '山田太郎'
    scenario.quote.staffName = '販売担当'
    scenario.quote.carName = 'セレナ'

    const safe = createShareSafeScenario(scenario)
    const decoded = decodeSharedScenario(encodeSharedScenario(scenario))

    expect(safe.quote.customerName).toBe('')
    expect(safe.quote.staffName).toBe('')
    expect(decoded?.quote.customerName).toBe('')
    expect(decoded?.quote.staffName).toBe('')
    expect(decoded?.quote.carName).toBe('セレナ')
  })

  it('ignores broken shared data', () => {
    expect(decodeSharedScenario('invalid-data')).toBeNull()
  })

  it('migrates v2 common periods to plan-specific periods', () => {
    const legacy = {
      id: 'legacy-id',
      name: '旧見積',
      updatedAt: '2025-01-01T00:00:00.000Z',
      scenario: {
        schemaVersion: 2,
        maintenance: { comparisonMonths: 72 },
        currentCar: {},
        cash: {},
        credit: { paymentCount: 36 },
        bvc: { paymentCount: 48 },
        omatome: { paymentCount: 84 },
      },
    }
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify([legacy]))

    const migrated = loadScenarios()[0].scenario
    expect(migrated.schemaVersion).toBe(11)
    expect(migrated.currentCar.firstRegistrationMonth).toBe('')
    expect(migrated.currentCar.currentMaintenanceYears).toBe(6)
    expect(migrated.cash.cashMaintenanceYears).toBe(6)
    expect(migrated.credit.creditMaintenanceYears).toBe(3)
    expect(migrated.bvc.bvcMaintenanceYears).toBe(4)
    expect(migrated.omatome.omatomeMaintenanceYears).toBe(7)
    expect(migrated.omatome.selectedMode).toBe('purchase')
    expect('maintenance' in migrated).toBe(false)
  })

  it('keeps plan-specific periods in shared data while removing names', () => {
    const scenario = createInitialScenario()
    scenario.quote.customerName = '個人名'
    scenario.cash.cashMaintenanceYears = 4
    scenario.credit.creditMaintenanceYears = 3
    scenario.credit.firstPayment = 55_000
    scenario.credit.monthlyPayment = 45_000
    scenario.bvc.firstPayment = 60_000
    scenario.bvc.monthlyPayment = 50_000

    const decoded = decodeSharedScenario(encodeSharedScenario(scenario))
    expect(decoded?.quote.customerName).toBe('')
    expect(decoded?.cash.cashMaintenanceYears).toBe(4)
    expect(decoded?.credit.creditMaintenanceYears).toBe(3)
    expect(decoded?.credit.firstPayment).toBe(55_000)
    expect(decoded?.credit.monthlyPayment).toBe(45_000)
    expect(decoded?.bvc.firstPayment).toBe(60_000)
    expect(decoded?.bvc.monthlyPayment).toBe(50_000)
  })

  it('migrates v3 vehicle pricing, powertrain, periods, and tire cycle', () => {
    const legacy = {
      id: 'v3-id',
      name: 'v3見積',
      updatedAt: '2026-01-01T00:00:00.000Z',
      scenario: {
        schemaVersion: 3,
        vehicle: {
          basePrice: 3_000_000,
          optionPrice: 300_000,
          taxAndFees: 200_000,
          discount: 100_000,
          powertrain: 'hybrid',
        },
        currentCar: { currentMaintenanceMonths: 54, tireCycleMonths: 36 },
        cash: { cashMaintenanceMonths: 54 },
        credit: { creditMaintenanceMonths: 36 },
        bvc: { bvcMaintenanceMonths: 60 },
        omatome: { omatomeMaintenanceMonths: 84 },
      },
    }
    localStorage.setItem(V3_STORAGE_KEY, JSON.stringify([legacy]))

    const migrated = loadScenarios()[0].scenario
    expect(migrated.vehicle.estimateTotal).toBe(3_400_000)
    expect(migrated.vehicle.powertrain).toBe('e-power')
    expect(migrated.currentCar.currentMaintenanceYears).toBe(5)
    expect(migrated.currentCar.tireCycleYears).toBe(3)
    expect(migrated.cash.cashMaintenanceYears).toBe(5)
    expect(migrated.credit.creditMaintenanceYears).toBe(3)
    expect(migrated.bvc.bvcMaintenanceYears).toBe(5)
    expect(migrated.omatome.omatomeMaintenanceYears).toBe(7)
    expect(migrated.currentCar.repairCost).toBe('')
    expect(migrated.newMaintenance.repairCost).toBe('')
    expect(migrated.usedMaintenance.repairCost).toBe('')
  })

  it('migrates v4 used-car data without borrowing the new-car estimate', () => {
    const legacy = {
      id: 'v4-id',
      name: '中古車見積',
      updatedAt: '2026-06-01T00:00:00.000Z',
      scenario: {
        ...createInitialScenario(),
        schemaVersion: 4,
        vehicle: {
          ...createInitialScenario().vehicle,
          condition: 'used',
          estimateTotal: 5_000_000,
        },
        omatome: {
          ...createInitialScenario().omatome,
          included: {
            inspection: false,
            legalInspection: false,
            sixMonthInspection: false,
            tires: false,
            tax: false,
            insurance: true,
          },
        },
      },
    }
    localStorage.setItem(V4_STORAGE_KEY, JSON.stringify([legacy]))

    const migrated = loadScenarios()[0].scenario
    expect(migrated.schemaVersion).toBe(11)
    expect(migrated.vehicle.estimateTotal).toBe(5_000_000)
    expect(migrated.vehicle.usedCarPurchasePrice).toBe('')
    expect(migrated.omatome.included).toEqual({
      inspection: true,
      legalInspection: true,
      sixMonthInspection: true,
      tires: true,
      tax: true,
      insurance: true,
    })
  })

  it('keeps the used-car purchase price in shared data while removing names', () => {
    const scenario = createInitialScenario()
    scenario.vehicle.condition = 'used'
    scenario.vehicle.usedCarPurchasePrice = 2_800_000
    scenario.quote.customerName = '個人名'
    scenario.quote.staffName = '担当者名'

    const decoded = decodeSharedScenario(encodeSharedScenario(scenario))
    expect(decoded?.vehicle.usedCarPurchasePrice).toBe(2_800_000)
    expect(decoded?.quote.customerName).toBe('')
    expect(decoded?.quote.staffName).toBe('')
  })

  it('migrates v5 modes and unsupported payment counts to v11', () => {
    const legacyScenario = createInitialScenario()
    const legacy = {
      id: 'v5-id',
      name: 'v5見積',
      updatedAt: '2026-06-20T00:00:00.000Z',
      scenario: {
        ...legacyScenario,
        schemaVersion: 5,
        bvc: {
          ...legacyScenario.bvc,
          paymentCount: 42,
          selectedMode: 'purchase',
          bvcMaintenanceYears: 3,
        },
        omatome: {
          ...legacyScenario.omatome,
          paymentCount: 72,
          omatomeMaintenanceYears: 5,
        },
      },
    }
    localStorage.setItem(V5_STORAGE_KEY, JSON.stringify([legacy]))

    const migrated = loadScenarios()[0].scenario
    expect(migrated.schemaVersion).toBe(11)
    expect(migrated.bvc.paymentCount).toBe(36)
    expect(migrated.bvc.selectedMode).toBe('purchase')
    expect(migrated.bvc.bvcMaintenanceYears).toBe(3)
    expect(migrated.omatome.paymentCount).toBe(60)
    expect(migrated.omatome.selectedMode).toBe('purchase')
    expect(migrated.omatome.omatomeMaintenanceYears).toBe(5)
  })

  it('keeps new v11 omatome scenarios in return mode', () => {
    const scenario = createInitialScenario()
    const decoded = decodeSharedScenario(encodeSharedScenario(scenario))

    expect(decoded?.schemaVersion).toBe(11)
    expect(decoded?.omatome.selectedMode).toBe('return')
  })

  it('migrates v6 credit and BVC payments as automatic calculation', () => {
    const current = createInitialScenario()
    const credit = { ...current.credit } as Record<string, unknown>
    const bvc = { ...current.bvc } as Record<string, unknown>
    delete credit.firstPayment
    delete credit.monthlyPayment
    delete bvc.firstPayment
    delete bvc.monthlyPayment
    const legacy = {
      id: 'v6-id',
      name: 'v6見積',
      updatedAt: '2026-06-21T00:00:00.000Z',
      scenario: {
        ...current,
        schemaVersion: 6,
        credit,
        bvc,
      },
    }
    localStorage.setItem(V6_STORAGE_KEY, JSON.stringify([legacy]))

    const migrated = loadScenarios()[0].scenario
    expect(migrated.schemaVersion).toBe(11)
    expect(migrated.credit.firstPayment).toBe('')
    expect(migrated.credit.monthlyPayment).toBe('')
    expect(migrated.bvc.firstPayment).toBe('')
    expect(migrated.bvc.monthlyPayment).toBe('')
  })

  it('migrates v7 current-car inspection input to first registration month', () => {
    const current = createInitialScenario()
    const legacyCurrentCar = {
      ...current.currentCar,
      nextInspectionMonths: 12,
    } as Record<string, unknown>
    delete legacyCurrentCar.firstRegistrationMonth
    const legacy = {
      id: 'v7-id',
      name: 'v7見積',
      updatedAt: '2026-06-22T00:00:00.000Z',
      scenario: {
        ...current,
        schemaVersion: 7,
        currentCar: legacyCurrentCar,
      },
    }
    localStorage.setItem(V7_STORAGE_KEY, JSON.stringify([legacy]))

    const migrated = loadScenarios()[0].scenario
    expect(migrated.schemaVersion).toBe(11)
    expect(migrated.currentCar.firstRegistrationMonth).toBe('')
    expect('nextInspectionMonths' in migrated.currentCar).toBe(false)
  })

  it('migrates v9 separate repair costs to v11 maintenance groups', () => {
    const legacyScenario = createInitialScenario()
    const legacyMaintenance = {
      ...legacyScenario.newMaintenance,
      currentRepairCost: 40_000,
      newRepairCost: 80_000,
      usedRepairCost: 120_000,
    } as Record<string, unknown>
    const legacy = {
      id: 'v9-id',
      name: 'v9見積',
      updatedAt: '2026-06-23T00:00:00.000Z',
      scenario: {
        ...legacyScenario,
        schemaVersion: 9,
        maintenance: legacyMaintenance,
      },
    }
    localStorage.setItem(V9_STORAGE_KEY, JSON.stringify([legacy]))

    const migrated = loadScenarios()[0].scenario
    expect(migrated.schemaVersion).toBe(11)
    expect(migrated.currentCar.repairCost).toBe(40_000)
    expect(migrated.newMaintenance.repairCost).toBe(80_000)
    expect(migrated.usedMaintenance.repairCost).toBe(120_000)
    expect('maintenance' in migrated).toBe(false)
  })

  it('migrates v10 cash visibility into v11 plan selection', () => {
    const current = createInitialScenario()
    const legacy = {
      id: 'v10-id',
      name: 'v10見積',
      updatedAt: '2026-07-01T00:00:00.000Z',
      scenario: {
        ...current,
        schemaVersion: 10,
        comparison: undefined,
        cash: { ...current.cash, enabled: false },
      },
    }
    localStorage.setItem(V10_STORAGE_KEY, JSON.stringify([legacy]))

    const migrated = loadScenarios()[0].scenario
    expect(migrated.schemaVersion).toBe(11)
    expect(migrated.comparison.enabledPlans).toEqual({
      cash: false,
      credit: true,
      bvc: true,
      omatome: true,
    })
    expect('enabled' in migrated.cash).toBe(false)
  })

  it('separates local scenarios by organization and user', () => {
    const first = createInitialScenario()
    first.quote.scenarioName = '担当者A'
    const second = createInitialScenario()
    second.quote.scenarioName = '担当者B'

    saveScenario(first, undefined, localStorage, { organizationId: 'org-1', userId: 'user-a' })
    saveScenario(second, undefined, localStorage, { organizationId: 'org-1', userId: 'user-b' })

    expect(loadScenarios(localStorage, { organizationId: 'org-1', userId: 'user-a' }))
      .toHaveLength(1)
    expect(loadScenarios(localStorage, { organizationId: 'org-1', userId: 'user-a' })[0].name)
      .toBe('担当者A')
    expect(loadScenarios(localStorage, { organizationId: 'org-1', userId: 'user-b' })[0].name)
      .toBe('担当者B')
  })

  it('preserves cloud revision metadata when editing a cached scenario', () => {
    const scenario = createInitialScenario()
    const first = saveScenario(scenario)
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{
      ...first,
      organizationId: 'org-1',
      ownerUserId: 'user-a',
      ownerName: '担当者A',
      createdBy: 'user-a',
      updatedBy: 'user-a',
      serverUpdatedAt: '2026-07-10T00:00:00.000Z',
      revision: 4,
    }]))

    const updated = saveScenario(scenario, first.id)
    expect(updated.revision).toBe(4)
    expect(updated.ownerUserId).toBe('user-a')
    expect(updated.organizationId).toBe('org-1')
  })
})
