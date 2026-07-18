import type { MaintenanceInput, Scenario, VehicleClass } from './types'

export const SCHEMA_VERSION = 11

export const MAINTENANCE_DEFAULTS: Record<
  VehicleClass,
  Pick<
    MaintenanceInput,
    | 'inspectionCost'
    | 'legalInspectionCost'
    | 'sixMonthInspectionCost'
    | 'annualTax'
    | 'tireCost'
  >
> = {
  kei: {
    inspectionCost: 100_000,
    legalInspectionCost: 26_290,
    sixMonthInspectionCost: 12_100,
    annualTax: 10_800,
    tireCost: 150_000,
  },
  s: {
    inspectionCost: 120_000,
    legalInspectionCost: 28_490,
    sixMonthInspectionCost: 13_200,
    annualTax: 30_600,
    tireCost: 200_000,
  },
  m: {
    inspectionCost: 150_000,
    legalInspectionCost: 34_650,
    sixMonthInspectionCost: 17_600,
    annualTax: 36_000,
    tireCost: 300_000,
  },
  l: {
    inspectionCost: 150_000,
    legalInspectionCost: 37_950,
    sixMonthInspectionCost: 17_600,
    annualTax: 40_000,
    tireCost: 350_000,
  },
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function createInitialScenario(): Scenario {
  const maintenance = MAINTENANCE_DEFAULTS.m
  const purchaseMaintenance: MaintenanceInput = {
    ...maintenance,
    monthlyInsurance: '',
    repairCost: '',
    tireCycleYears: 4,
    includeInsurance: true,
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    comparison: {
      enabledPlans: {
        cash: true,
        credit: true,
        bvc: true,
        omatome: true,
      },
    },
    quote: {
      scenarioName: '新規見積',
      quoteDate: today(),
      staffName: '',
      customerName: '',
      carName: '',
      grade: '',
    },
    vehicle: {
      estimateTotal: '',
      usedCarPurchasePrice: '',
      tradeIn: '',
      condition: 'new',
      vehicleClass: 'm',
      powertrain: 'gasoline',
      nextInspectionMonths: '',
    },
    currentCar: {
      currentMaintenanceYears: 5,
      originalPurchasePrice: '',
      remainingDebt: '',
      remainingPayments: '',
      monthlyPayment: '',
      firstRegistrationMonth: '',
      inspectionCost: '',
      legalInspectionCost: '',
      sixMonthInspectionCost: '',
      tireCost: '',
      annualTax: '',
      monthlyInsurance: '',
      repairCost: '',
      tireCycleYears: 4,
    },
    newMaintenance: { ...purchaseMaintenance },
    usedMaintenance: { ...purchaseMaintenance },
    cash: {
      cashMaintenanceYears: 5,
    },
    credit: {
      creditMaintenanceYears: 5,
      downPayment: '',
      annualRate: 4.9,
      firstPayment: '',
      monthlyPayment: '',
      paymentCount: 60,
      bonusPayment: '',
    },
    bvc: {
      bvcMaintenanceYears: 5,
      downPayment: '',
      annualRate: 4.9,
      firstPayment: '',
      monthlyPayment: '',
      paymentCount: 60,
      bonusPayment: '',
      residualValue: '',
      selectedMode: 'return',
    },
    omatome: {
      omatomeMaintenanceYears: 5,
      downPayment: '',
      firstPayment: '',
      monthlyPayment: '',
      paymentCount: 60,
      bonusPayment: '',
      finalPayment: '',
      selectedMode: 'return',
      included: {
        inspection: true,
        legalInspection: true,
        sixMonthInspection: true,
        tires: true,
        tax: true,
        insurance: false,
      },
    },
  }
}
