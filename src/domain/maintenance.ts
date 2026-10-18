import Decimal from 'decimal.js'
import { normalizeOptionalYen, normalizeYen, roundYen } from './money'
import type {
  MaintenanceBreakdownItem,
  MaintenanceInput,
  MaintenanceResult,
  Scenario,
  VehicleCondition,
} from './types'

export function normalizeMaintenanceMonths(value: number | ''): number {
  return Math.min(240, Math.max(1, Math.floor(Number(value) || 1)))
}

export function normalizeMaintenanceYears(value: number | ''): number {
  return Math.min(20, Math.max(1, Math.round(Number(value) || 1)))
}

export function maintenanceYearsToMonths(value: number | ''): number {
  return normalizeMaintenanceYears(value) * 12
}

export function calculateScenarioMaintenance(
  scenario: Scenario,
  years: number,
  vehicleCondition: VehicleCondition = scenario.vehicle.condition,
): MaintenanceResult {
  const maintenanceInput = vehicleCondition === 'used'
    ? scenario.usedMaintenance
    : scenario.newMaintenance
  return calculateMaintenance({
    ...maintenanceInput,
    comparisonMonths: maintenanceYearsToMonths(years),
    vehicleCondition,
    nextInspectionMonths:
      vehicleCondition === 'used' ? scenario.vehicle.nextInspectionMonths : '',
  })
}

export type MaintenanceCalculationInput = MaintenanceInput & {
  comparisonMonths: number
  vehicleCondition: VehicleCondition
  nextInspectionMonths: number | ''
  inspectionMonthsOverride?: number[]
  inspectionCycleLabel?: string
  inspectionWarning?: string
}

function occurrenceMonths(
  start: number,
  interval: number,
  months: number,
  options: { includeFinalMonth?: boolean } = {},
): number[] {
  if (start <= 0 || interval <= 0 || months <= 0) return []
  const includeFinalMonth = options.includeFinalMonth ?? true
  const occurrences: number[] = []
  for (let month = start; includeFinalMonth ? month <= months : month < months; month += interval) {
    occurrences.push(month)
  }
  return occurrences
}

function createBreakdownItem(
  id: MaintenanceBreakdownItem['id'],
  label: string,
  unitCost: number,
  cycleLabel: string,
  count: number,
): MaintenanceBreakdownItem {
  return {
    id,
    label,
    unitCost,
    cycleLabel,
    count,
    total: roundYen(new Decimal(unitCost).mul(count)),
  }
}

export function calculateMaintenance(input: MaintenanceCalculationInput): MaintenanceResult {
  if (input.inspectionServiceCost !== undefined) input = { ...input, inspectionCost: Number(input.inspectionServiceCost || 0) + Number(input.inspectionLegalCost || 0) }
  const months = Math.max(0, Math.floor(input.comparisonMonths || 0))
  const warnings: string[] = []
  const nextInspection = normalizeOptionalYen(input.nextInspectionMonths)
  let inspectionStart = 36

  if (input.vehicleCondition === 'used' && input.inspectionMonthsOverride === undefined) {
    if (nextInspection === '' || nextInspection <= 0) {
      inspectionStart = 0
      warnings.push('中古車の次回車検までの残月数が未入力のため、車検費用は計算していません。')
    } else {
      inspectionStart = nextInspection
    }
  }

  if (input.inspectionWarning) warnings.push(input.inspectionWarning)

  const inspectionMonths = input.inspectionMonthsOverride
    ? input.inspectionMonthsOverride
      .map((month) => Math.floor(month))
      .filter((month) => month >= 0 && month < months)
    : occurrenceMonths(inspectionStart, 24, months, {
      includeFinalMonth: false,
    })
  const inspectionSet = new Set(inspectionMonths)
  const legalInspectionMonths = occurrenceMonths(12, 12, months).filter(
    (month) => !inspectionSet.has(month),
  )
  const legalSet = new Set(legalInspectionMonths)
  const sixMonthInspectionMonths = occurrenceMonths(6, 12, months).filter(
    (month) => !inspectionSet.has(month) && !legalSet.has(month),
  )

  const inspectionCost = normalizeYen(input.inspectionCost)
  const legalInspectionCost = normalizeYen(input.legalInspectionCost)
  const sixMonthInspectionCost = normalizeYen(input.sixMonthInspectionCost)
  const tireCost = normalizeYen(input.tireCost)
  const annualTax = normalizeYen(input.annualTax)
  const monthlyInsurance = normalizeYen(input.monthlyInsurance)
  const repairCost = normalizeYen(input.repairCost)
  const tireCycleYears = normalizeMaintenanceYears(input.tireCycleYears || 4)
  const tireCycleMonths = tireCycleYears * 12
  const tireCount = Math.floor(months / tireCycleMonths)
  const taxCount = months > 0 ? Math.ceil(months / 12) : 0

  const breakdown: MaintenanceBreakdownItem[] = [
    createBreakdownItem(
      'inspection',
      '車検',
      inspectionCost,
      input.inspectionCycleLabel ??
        (input.vehicleCondition === 'new' ? '初回3年後・以後2年ごと' : '次回指定・以後2年ごと'),
      inspectionMonths.length,
    ),
    createBreakdownItem(
      'legalInspection',
      '法定12か月点検',
      legalInspectionCost,
      '1年ごと（車検月を除く）',
      legalInspectionMonths.length,
    ),
    createBreakdownItem(
      'sixMonthInspection',
      '6か月点検',
      sixMonthInspectionCost,
      '6か月ごと（重複月を除く）',
      sixMonthInspectionMonths.length,
    ),
    createBreakdownItem('tires', '夏・冬タイヤ', tireCost, `${tireCycleYears}年ごと`, tireCount),
    createBreakdownItem('tax', '自動車税', annualTax, '年1回', taxCount),
    createBreakdownItem(
      'insurance',
      '任意保険',
      monthlyInsurance,
      '毎月',
      input.includeInsurance ? months : 0,
    ),
    createBreakdownItem('repair', '修理費用', repairCost, '任意入力', repairCost > 0 ? 1 : 0),
  ]

  const findTotal = (id: MaintenanceBreakdownItem['id']) =>
    breakdown.find((item) => item.id === id)?.total ?? 0

  const result: MaintenanceResult = {
    months,
    inspectionMonths,
    legalInspectionMonths,
    sixMonthInspectionMonths,
    inspectionCost: findTotal('inspection'),
    legalInspectionCost: findTotal('legalInspection'),
    sixMonthInspectionCost: findTotal('sixMonthInspection'),
    tireCost: findTotal('tires'),
    taxCost: findTotal('tax'),
    insuranceCost: findTotal('insurance'),
    repairCost: findTotal('repair'),
    total: breakdown.reduce((sum, item) => sum + item.total, 0),
    breakdown,
    warnings,
  }

  return result
}
