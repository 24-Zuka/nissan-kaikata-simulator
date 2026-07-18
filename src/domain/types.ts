export type MoneyInput = number | ''
export type VehicleCondition = 'new' | 'used'
export type PriceBasis = 'current' | 'new' | 'used'
export type VehicleClass = 'kei' | 's' | 'm' | 'l'
export type Powertrain = 'gasoline' | 'e-power' | 'e-4orce' | 'ev'
export type BvcMode = 'return' | 'purchase'
export type OmatomeMode = 'return' | 'purchase'
export type PlanId = 'statusQuo' | 'cash' | 'credit' | 'bvc' | 'omatome'
export type PurchasablePlanId = Exclude<PlanId, 'statusQuo'>
export type ScenarioSectionId =
  | 'quote'
  | 'vehicle'
  | 'currentCar'
  | 'newMaintenance'
  | 'usedMaintenance'
  | PurchasablePlanId

export type QuoteInput = {
  scenarioName: string
  quoteDate: string
  staffName: string
  customerName: string
  carName: string
  grade: string
}

export type VehicleInput = {
  estimateTotal: MoneyInput
  usedCarPurchasePrice: MoneyInput
  tradeIn: MoneyInput
  condition: VehicleCondition
  vehicleClass: VehicleClass
  powertrain: Powertrain
  nextInspectionMonths: number | ''
}

export type CurrentCarInput = {
  currentMaintenanceYears: number
  originalPurchasePrice: MoneyInput
  remainingDebt: MoneyInput
  remainingPayments: number | ''
  monthlyPayment: MoneyInput
  firstRegistrationMonth: string
  inspectionCost: MoneyInput
  legalInspectionCost: MoneyInput
  sixMonthInspectionCost: MoneyInput
  tireCost: MoneyInput
  annualTax: MoneyInput
  monthlyInsurance: MoneyInput
  repairCost: MoneyInput
  tireCycleYears: number | ''
}

export type MaintenanceInput = {
  inspectionCost: MoneyInput
  legalInspectionCost: MoneyInput
  sixMonthInspectionCost: MoneyInput
  tireCost: MoneyInput
  annualTax: MoneyInput
  monthlyInsurance: MoneyInput
  repairCost: MoneyInput
  tireCycleYears: number
  includeInsurance: boolean
}

export type CashInput = {
  cashMaintenanceYears: number
}

export type ComparisonInput = {
  enabledPlans: Record<PurchasablePlanId, boolean>
}

export type CreditInput = {
  creditMaintenanceYears: number
  downPayment: MoneyInput
  annualRate: number | ''
  firstPayment: MoneyInput
  monthlyPayment: MoneyInput
  paymentCount: number
  bonusPayment: MoneyInput
}

export type BvcInput = {
  bvcMaintenanceYears: number
  downPayment: MoneyInput
  annualRate: number | ''
  firstPayment: MoneyInput
  monthlyPayment: MoneyInput
  paymentCount: number
  bonusPayment: MoneyInput
  residualValue: MoneyInput
  selectedMode: BvcMode
}

export type OmatomeIncludedItems = {
  inspection: boolean
  legalInspection: boolean
  sixMonthInspection: boolean
  tires: boolean
  tax: boolean
  insurance: boolean
}

export type OmatomeInput = {
  omatomeMaintenanceYears: number
  downPayment: MoneyInput
  firstPayment: MoneyInput
  monthlyPayment: MoneyInput
  paymentCount: number
  bonusPayment: MoneyInput
  finalPayment: MoneyInput
  selectedMode: OmatomeMode
  included: OmatomeIncludedItems
}

export type Scenario = {
  schemaVersion: number
  comparison: ComparisonInput
  quote: QuoteInput
  vehicle: VehicleInput
  currentCar: CurrentCarInput
  newMaintenance: MaintenanceInput
  usedMaintenance: MaintenanceInput
  cash: CashInput
  credit: CreditInput
  bvc: BvcInput
  omatome: OmatomeInput
}

export type ScenarioValidationIssue = {
  sectionId: ScenarioSectionId
  fieldId: string
  planId?: PlanId
  message: string
  severity: 'error' | 'warning'
}

export type MaintenanceBreakdownItem = {
  id:
    | 'inspection'
    | 'legalInspection'
    | 'sixMonthInspection'
    | 'tires'
    | 'tax'
    | 'insurance'
    | 'repair'
  label: string
  unitCost: number
  cycleLabel: string
  count: number
  total: number
}

export type MaintenanceResult = {
  months: number
  inspectionMonths: number[]
  legalInspectionMonths: number[]
  sixMonthInspectionMonths: number[]
  inspectionCost: number
  legalInspectionCost: number
  sixMonthInspectionCost: number
  tireCost: number
  taxCost: number
  insuranceCost: number
  repairCost: number
  total: number
  breakdown: MaintenanceBreakdownItem[]
  warnings: string[]
}

export type MaintenanceCoverageItem = {
  id: MaintenanceBreakdownItem['id']
  includedCost: number
  customerCost: number
}

export type MaintenanceCoverage = {
  includedThroughMonths: number
  includedCost: number
  customerCost: number
  items: MaintenanceCoverageItem[]
}

export type PlanBreakdown = {
  vehiclePrice: number
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
  repairCost: number
  omatomeIncludedCost: number
  omatomeExcludedCost: number
  omatomeReflectedCost: number
  interestFee: number
  residualValue: number
  totalPayment: number
  effectiveTotal: number
  effectiveMonthly: number
}

export type PlanResult = {
  planId: PlanId
  label: string
  isVisible: boolean
  isComplete: boolean
  totalPayment: number
  effectiveTotal: number
  effectiveMonthly: number
  monthlyEquivalent: number
  priceBasis: PriceBasis
  priceBasisAmount: number
  hasRequiredPrice: boolean
  maintenanceYears: number
  maintenanceMonths: number
  maintenance: MaintenanceResult
  maintenanceCoverage: MaintenanceCoverage
  selectedMode?: BvcMode | OmatomeMode
  initialPayment: number
  monthlyPayment: number
  secondAndLaterMonthlyPayment: number
  finalPayment: number
  bonusPayment: number
  bonusPaymentCount: number
  paymentCount: number
  residualValue: number
  interestFee: number
  includedItems: string[]
  excludedItems: string[]
  breakdown: PlanBreakdown
  warnings: string[]
  differenceFromStatusQuo?: number
}

export type BvcPlanResult = PlanResult & {
  selectedMode: BvcMode
  returnResult: PlanResult
  purchaseResult: PlanResult
}

export type OmatomePlanResult = PlanResult & {
  selectedMode: OmatomeMode
  returnResult: PlanResult
  purchaseResult: PlanResult
}

export type ComparisonResult = {
  scenario: Scenario
  newVehicleEstimateTotal: number
  usedCarPurchasePrice: number
  newVehicleTradeInDeduction: number
  newVehiclePurchaseAmount: number
  cashCreditPriceBasis: Extract<PriceBasis, 'new' | 'used'>
  cashCreditTradeInDeduction: number
  cashCreditPurchaseAmount: number
  plans: PlanResult[]
  visiblePlanCount: number
  completePlans: PlanResult[]
  incompletePlans: PlanResult[]
  validationIssues: ScenarioValidationIssue[]
  bvc: BvcPlanResult
  omatome: OmatomePlanResult
  warnings: string[]
}

export type PaymentScheduleInput = {
  principal: MoneyInput
  annualRate: number | ''
  paymentCount: number
  bonusPayment?: MoneyInput
  bonusInterval?: number
  regularPaymentCount?: number
  residualValue?: MoneyInput
}

export type PaymentSchedule = {
  firstPayment: number
  secondAndLaterMonthlyPayment: number
  regularPaymentCount: number
  bonusPayment: number
  bonusPaymentCount: number
  residualValue: number
  totalPayment: number
  interestFee: number
  minimumEqualMonthlyPayment: number
  warnings: string[]
}

export type StatusQuoVisibility = {
  showInDetailComparison: boolean
  showInPrintComparison: boolean
  showInCustomerPresentation: boolean
  showInDifferenceComparison: boolean
  showPastPurchasePriceRow: boolean
}

export type SavedScenario = {
  id: string
  name: string
  updatedAt: string
  scenario: Scenario
  organizationId?: string
  ownerUserId?: string | null
  ownerName?: string
  createdBy?: string
  updatedBy?: string
  revision?: number
  serverUpdatedAt?: string
}

export type CloudScenarioRecord = SavedScenario & {
  organizationId: string
  ownerUserId: string | null
  ownerName: string
  createdBy: string
  updatedBy: string
  serverUpdatedAt: string
  revision: number
}

export type CloudScenarioSummary = Omit<CloudScenarioRecord, 'scenario'>

type SyncOperationBase = {
  id: string
  scenarioId: string
  queuedAt: string
  status: 'pending'
}

export type SyncOperation =
  | (SyncOperationBase & { type: 'upsert'; record: SavedScenario })
  | (SyncOperationBase & { type: 'delete' })
