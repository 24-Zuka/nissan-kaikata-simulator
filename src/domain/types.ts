/**
 * ドメイン型定義
 *
 * このアプリで扱う「シナリオ（入力）」と「プラン計算結果（出力）」の型を集約する。
 * 計算結果型 PlanResult / PlanBreakdown は、画面・印刷・お客様説明モードが
 * 「同一オブジェクトを表示するだけ」になるよう、表示に必要な値をすべて保持する。
 */

// MaintenanceResult は計算結果(ScenarioResult)に内包するため型のみ参照する（型専用の循環参照）。
import type { MaintenanceResult } from './maintenance'

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

/**
 * 正式見積（NFS支払予定表）の手入力。
 * useOfficialQuote=true かつ必要値が入力されているとき、計算値より手入力値を優先する。
 * 既定は未使用（undefined/false）のため既存の計算結果は変わらない。
 */
export type OfficialQuoteInput = {
  useOfficialQuote?: boolean
  /** 初回支払額 */
  firstPayment?: OptionalYen
  /** 2回目以降月額 */
  monthlyPayment?: OptionalYen
  /** 2回目以降回数 */
  monthlyCount?: OptionalYen
  /** 最終回支払額（BVCは残価。未指定ならプラン既定）。 */
  finalPayment?: OptionalYen
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
  /** 正式見積の手入力（任意）。 */
  official?: OfficialQuoteInput
}

export type BvcInput = {
  downPayment: number
  annualRate: number
  months: number
  /** 残価（最終回据置額） */
  residualValue: number
  /** 概算残価率(%)。residualValue が 0 のときのみ、見積総額×率 で残価を導出する（任意）。 */
  residualRate?: number
  bonusPayment: number
  bonusMonths: number[]
  /** return=返却 / purchase=買取 */
  mode: 'return' | 'purchase'
  /** 正式見積の手入力（任意）。 */
  official?: OfficialQuoteInput
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
  /** 正式見積の手入力（任意）。monthlyPayment より詳細な初回/回数指定に使う。 */
  official?: OfficialQuoteInput
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

/**
 * A/B/C 比較のためのワークスペース。最大3パターンを保持する。
 * 各パターンは独立した Scenario（車両・見積・支払条件）を持つ。
 */
export type ScenarioWorkspace = {
  /** 1〜3 パターン。 */
  patterns: Scenario[]
  /** 現在編集中のパターンID。 */
  activeId: string
}

/** A/B/C パターンの上限。 */
export const MAX_PATTERNS = 3

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

/** BVC 返却/買取の両建て結果（お客様説明モードの比較表示用）。 */
export type BvcBothResult = {
  return: PlanResult
  purchase: PlanResult
  /** 買取時 − 返却時の支払総額差（残価相当）。 */
  residualDiff: number
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
  /** 維持費用内訳（画面・印刷・説明モードが同一オブジェクトを参照するため結果に内包）。 */
  maintenance: MaintenanceResult
  /** BVC 返却/買取の両建て（同上。再計算による不一致を防ぐ）。 */
  bvcBoth: BvcBothResult
}
