/**
 * ドメイン型定義
 *
 * このアプリで扱う「シナリオ（入力）」と「プラン計算結果（出力）」の型を集約する。
 * 計算結果型 PlanResult / PlanBreakdown は、画面・印刷・お客様説明モードが
 * 「同一オブジェクトを表示するだけ」になるよう、表示に必要な値をすべて保持する。
 */

// ---------------------------------------------------------------------------
// 列挙的な型
// ---------------------------------------------------------------------------

/** 比較対象の5プラン。表示名「リース」は使わず omatome を用いる。 */
export type PlanId = 'statusQuo' | 'cash' | 'credit' | 'bvc' | 'omatome'

export type VehicleMode = 'new' | 'used'

/** 維持費デフォルト値のクラス分け。kei=軽 / small=S / medium=M / large=L */
export type CarType = 'kei' | 'small' | 'medium' | 'large'

export type Powertrain = 'gasoline' | 'hybrid' | 'ev'

/** 未入力を許容する金額入力欄。'' は未入力を表す。 */
export type OptionalYen = number | ''

// ---------------------------------------------------------------------------
// 入力モデル
// ---------------------------------------------------------------------------

export type CurrentCarInput = {
  originalPurchasePrice: OptionalYen
  remainingLoanBalance: OptionalYen
  remainingLoanMonths: OptionalYen
  monthlyPayment: OptionalYen
  annualTax: OptionalYen
  inspectionCost: OptionalYen
  maintenanceCost: OptionalYen
  tireCost: OptionalYen
  insuranceMonthly: OptionalYen
}

export type MaintenanceInput = {
  /** 比較シミュレーション年数 */
  simulationYears: number
  inspectionCost: OptionalYen
  legalInspectionCost: OptionalYen
  sixMonthInspectionCost: OptionalYen
  annualTax: OptionalYen
  tireCost: OptionalYen
  /** 夏・冬タイヤの交換周期（年）。例: 3 = 3年ごと */
  tireReplacementCycleYears: number
  /** 任意保険 月額。初期値は未入力('')。デフォルト金額は入れない。 */
  insuranceMonthly: OptionalYen
  includeInsurance: boolean
}

export type CashInput = {
  // 現金一括は車両見積から算出するため固有入力は持たない（将来拡張用）。
  // TODO(SPEC): 現金値引きや現金特有の調整があれば追加する。
  _placeholder?: never
}

export type CreditInput = {
  /** 分割対象元金の上書き（正式見積転記用）。未指定なら支払対象総額-頭金から算出。 */
  principalOverride?: number
  downPayment: number
  /** 実質年率 (%) 例: 3.9 */
  annualRate: number
  months: number
  bonusPayment: number
  /** ボーナス加算月（1-12）。例: [1, 7] */
  bonusMonths: number[]
}

export type BvcInput = {
  downPayment: number
  annualRate: number
  months: number
  /** 残価（最終回据置額） */
  residualValue: number
  bonusPayment: number
  bonusMonths: number[]
  /** return=返却 / purchase=買取 */
  mode: 'return' | 'purchase'
}

export type OmatomeInput = {
  months: number
  downPayment: number
  annualRate: number
  includeInspection: boolean
  includeLegalInspection: boolean
  includeSixMonthInspection: boolean
  includeTires: boolean
  includeTax: boolean
  includeInsurance: boolean
  /** 月額の直接上書き（正式見積転記用） */
  monthlyPayment?: OptionalYen
}

export type Scenario = {
  id: string
  name: string

  customerName: string
  staffName: string
  quoteDate: string

  vehicleName: string
  grade: string
  vehicleMode: VehicleMode
  carType: CarType
  powertrain: Powertrain

  vehiclePrice: number
  optionPrice: number
  taxAndFees: number
  discount: number
  tradeIn: number

  currentCar: CurrentCarInput
  maintenance: MaintenanceInput

  cash: CashInput
  credit: CreditInput
  bvc: BvcInput
  omatome: OmatomeInput
}

// ---------------------------------------------------------------------------
// 出力モデル
// ---------------------------------------------------------------------------

export type PlanBreakdown = {
  vehiclePrice: number
  optionPrice: number
  taxAndFees: number
  discount: number
  tradeIn: number

  principal: number
  downPayment: number

  inspectionCost: number
  legalInspectionCost: number
  sixMonthInspectionCost: number
  maintenanceCost: number
  tireCost: number
  taxCost: number
  insuranceCost: number

  /** おまとめプランに含めた維持費合計 */
  omatomeIncludedCost: number
  /** おまとめプランに含めず別途必要な維持費合計 */
  omatomeExcludedCost: number

  interestFee: number
  residualValue: number
  totalPayment: number
  effectiveTotal: number
  effectiveMonthly: number
}

export type PlanResult = {
  planId: PlanId
  label: string

  /** 比較表・印刷に表示してよいか（現状維持の表示条件等） */
  isVisible: boolean
  /** 計算に必要な入力が揃っているか */
  isComplete: boolean

  /** 支払総額（契約に基づく支払いの総和） */
  totalPayment: number
  /** 実質総額（維持費等を含めた実質負担） */
  effectiveTotal: number
  /** 実質月額（実質総額 / 比較月数） */
  effectiveMonthly: number

  initialPayment: number
  monthlyPayment: number
  secondAndLaterMonthlyPayment: number
  finalPayment: number

  /** 月々の支払回数（現金一括は0=一括）。 */
  paymentCount: number

  bonusPayment: number
  bonusPaymentCount: number

  residualValue: number
  interestFee: number

  includedItems: string[]
  excludedItems: string[]

  breakdown: PlanBreakdown
  warnings: string[]
}

/** 5プラン分の計算結果をまとめたもの。UIはこれを参照するだけ。 */
export type ScenarioResult = {
  statusQuo: PlanResult
  cash: PlanResult
  credit: PlanResult
  bvc: PlanResult
  omatome: PlanResult
  /** 比較月数（実質月額の割り基準） */
  comparisonMonths: number
}
