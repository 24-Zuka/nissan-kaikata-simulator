/**
 * 定数・初期値
 *
 * 重要:
 * - 任意保険(insuranceMonthly)は初期値を入れない（'' = 未入力）。
 * - 表示名「リース」は使わず「おまとめプラン」を用いる。
 */

import type {
  CarType,
  PlanId,
  Scenario,
  MaintenanceInput,
} from './types'

/** プラン表示名（リース表記は使用しない） */
export const PLAN_LABELS: Record<PlanId, string> = {
  statusQuo: '現状維持',
  cash: '現金一括',
  credit: 'クレジット',
  bvc: 'BVC',
  omatome: 'おまとめプラン',
}

/** 表示順（左から） */
export const PLAN_ORDER: PlanId[] = ['statusQuo', 'cash', 'credit', 'bvc', 'omatome']

/** 車両クラス別の維持費デフォルト（任意保険は含めない）。section 15 準拠。 */
export type MaintenanceDefaults = {
  /** 車検 1回あたり */
  inspectionCost: number
  /** 法定12か月点検 1回あたり */
  legalInspectionCost: number
  /** 6か月点検 1回あたり */
  sixMonthInspectionCost: number
  /** 自動車税 年額 */
  annualTax: number
  /** 夏・冬タイヤ 1回あたり */
  tireCost: number
}

export const MAINTENANCE_DEFAULTS: Record<CarType, MaintenanceDefaults> = {
  // 軽自動車
  kei: {
    inspectionCost: 100_000,
    legalInspectionCost: 26_290,
    sixMonthInspectionCost: 12_100,
    annualTax: 10_800,
    tireCost: 150_000,
  },
  // Sクラス
  small: {
    inspectionCost: 120_000,
    legalInspectionCost: 28_490,
    sixMonthInspectionCost: 13_200,
    annualTax: 30_600,
    tireCost: 200_000,
  },
  // Mクラス
  medium: {
    inspectionCost: 150_000,
    legalInspectionCost: 34_650,
    sixMonthInspectionCost: 17_600,
    annualTax: 36_000,
    tireCost: 300_000,
  },
  // Lクラス
  large: {
    inspectionCost: 150_000,
    legalInspectionCost: 37_950,
    sixMonthInspectionCost: 17_600,
    annualTax: 40_000,
    tireCost: 350_000,
  },
}

export const CAR_TYPE_LABELS: Record<CarType, string> = {
  kei: '軽自動車',
  small: 'Sクラス',
  medium: 'Mクラス',
  large: 'Lクラス',
}

/** 維持費周期（年）。TODO(SPEC): 正確な周期は資料に合わせて確定する。 */
export const MAINTENANCE_CYCLE = {
  /** 車検: 新車は初回3年・以後2年。中古は2年ごと（statusQuo/維持費計算で分岐）。 */
  inspectionInitialYearsNew: 3,
  inspectionSubsequentYears: 2,
  /** 法定12か月点検: 毎年（車検年を除く想定）。 */
  legalInspectionYears: 1,
  /** 6か月点検: 6か月ごと = 年2回相当。 */
  sixMonthInspectionPerYear: 2,
  /** 夏・冬タイヤ: 既定3年ごと（MaintenanceInput.tireReplacementCycleYearsで上書き）。 */
  tireDefaultCycleYears: 3,
} as const

/** localStorage 保存キー */
export const STORAGE_KEYS = {
  scenario: 'nkks:scenario:v1',
  scenarioList: 'nkks:scenario-list:v1',
} as const

/** デフォルトの維持費入力（任意保険は未入力）。クラスに応じた金額を埋める。 */
export function createDefaultMaintenance(carType: CarType): MaintenanceInput {
  const d = MAINTENANCE_DEFAULTS[carType]
  return {
    simulationYears: 5,
    inspectionCost: d.inspectionCost,
    legalInspectionCost: d.legalInspectionCost,
    sixMonthInspectionCost: d.sixMonthInspectionCost,
    annualTax: d.annualTax,
    tireCost: d.tireCost,
    tireReplacementCycleYears: MAINTENANCE_CYCLE.tireDefaultCycleYears,
    // 任意保険はデフォルト金額を入れない（未入力）。
    insuranceMonthly: '',
    includeInsurance: false,
  }
}

/** 空の現在の車入力（すべて未入力 → 現状維持は非表示） */
export function createEmptyCurrentCar(): Scenario['currentCar'] {
  return {
    originalPurchasePrice: '',
    remainingLoanBalance: '',
    remainingLoanMonths: '',
    monthlyPayment: '',
    annualTax: '',
    inspectionCost: '',
    maintenanceCost: '',
    tireCost: '',
    insuranceMonthly: '',
  }
}

/** 新規シナリオの初期値 */
export function createDefaultScenario(): Scenario {
  const carType: CarType = 'small'
  return {
    id: generateId(),
    name: '新規見積',
    customerName: '',
    staffName: '',
    quoteDate: todayIso(),

    vehicleName: '',
    grade: '',
    vehicleMode: 'new',
    carType,
    powertrain: 'gasoline',

    vehiclePrice: 0,
    optionPrice: 0,
    taxAndFees: 0,
    discount: 0,
    tradeIn: 0,

    currentCar: createEmptyCurrentCar(),
    maintenance: createDefaultMaintenance(carType),

    cash: {},
    credit: {
      downPayment: 0,
      annualRate: 3.9,
      months: 60,
      bonusPayment: 0,
      bonusMonths: [1, 7],
    },
    bvc: {
      downPayment: 0,
      annualRate: 3.9,
      months: 60,
      residualValue: 0,
      bonusPayment: 0,
      bonusMonths: [1, 7],
      mode: 'return',
    },
    omatome: {
      months: 60,
      downPayment: 0,
      annualRate: 3.9,
      includeInspection: true,
      includeLegalInspection: true,
      includeSixMonthInspection: true,
      includeTires: true,
      includeTax: true,
      includeInsurance: false,
      monthlyPayment: '',
    },
  }
}

export function todayIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function generateId(): string {
  // crypto.randomUUID が無い環境でも安全にフォールバックする。
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID()
    }
  } catch {
    // noop
  }
  return `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`
}
