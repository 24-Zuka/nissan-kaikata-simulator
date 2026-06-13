/**
 * 維持費計算（純粋関数）
 *
 * シミュレーション期間にわたる各維持費項目の「1回あたり金額・周期・回数・合計」を算出する。
 * 任意保険は未入力('')のときは金額0かつ entered=false とし、表示側で「未入力」を表せるようにする。
 *
 * 回数・周期は資料依存のため TODO(SPEC) を付して既定値を採用している。
 */

import type { MaintenanceInput, VehicleMode } from './types'
import { MAINTENANCE_CYCLE } from './constants'
import { normalizeYen } from './money'

export type MaintenanceItemKey =
  | 'inspection'
  | 'legalInspection'
  | 'sixMonthInspection'
  | 'tax'
  | 'tires'
  | 'insurance'

export type MaintenanceItem = {
  key: MaintenanceItemKey
  /** 表示名。タイヤは必ず「夏・冬タイヤ」。 */
  label: string
  /** 1回あたり金額。保険は月額。 */
  unitCost: number
  /** 周期の表示ラベル。例: "2年ごと" "毎年" "6か月ごと" "月額" */
  cycleLabel: string
  /** 回数。保険は対象月数。 */
  count: number
  /** 合計 = unitCost * count（非負整数）。 */
  total: number
  /** 月額項目か（保険）。 */
  isMonthly: boolean
  /** 入力済みか（任意保険の未入力判定に使用）。 */
  entered: boolean
}

export type MaintenanceResult = {
  items: MaintenanceItem[]
  /** 維持費合計（保険を含む・includeInsurance=falseなら保険0）。 */
  total: number
  /** 保険を除いた維持費合計。 */
  totalExcludingInsurance: number
  insuranceTotal: number
  insuranceEntered: boolean
  /** 各キー→合計 のマップ（プラン側の按分・二重計上防止に使用）。 */
  byKey: Record<MaintenanceItemKey, number>
}

export type MaintenanceContext = {
  vehicleMode: VehicleMode
  /** 比較に使う年数。原則 maintenance.simulationYears。 */
  years: number
}

/**
 * 車検回数。
 * 新車: 初回3年・以後2年ごと。中古: 2年ごと（初回も2年後）。
 * TODO(SPEC): 中古/BVCの初回車検タイミングは資料で確定する。
 */
export function countInspections(years: number, mode: VehicleMode): number {
  const y = Math.max(0, Math.trunc(normalizeYen(years)))
  if (y <= 0) return 0
  if (mode === 'new') {
    const first = MAINTENANCE_CYCLE.inspectionInitialYearsNew // 3
    if (y < first) return 0
    return Math.floor((y - first) / MAINTENANCE_CYCLE.inspectionSubsequentYears) + 1
  }
  // 中古: 2年ごと
  return Math.floor(y / MAINTENANCE_CYCLE.inspectionSubsequentYears)
}

/**
 * 法定12か月点検回数。車検実施年は車検に含まれる想定で、その年は除外する。
 * TODO(SPEC): 車検年に別途12か月点検を行うかは資料で確定する。
 */
export function countLegalInspections(years: number, inspections: number): number {
  const y = Math.max(0, Math.trunc(normalizeYen(years)))
  return Math.max(0, y - inspections)
}

/**
 * 6か月点検回数。各年の中間(6か月地点)で年1回相当として数える。
 * TODO(SPEC): 6か月点検の実施回数は資料で確定する（「6か月ごと」表記は維持）。
 */
export function countSixMonthInspections(years: number): number {
  return Math.max(0, Math.trunc(normalizeYen(years)))
}

/** 夏・冬タイヤの交換回数。周期年数ごと。 */
export function countTireReplacements(years: number, cycleYears: number): number {
  const y = Math.max(0, Math.trunc(normalizeYen(years)))
  const c = Math.max(0, Math.trunc(normalizeYen(cycleYears)))
  if (c <= 0) return 0
  return Math.floor(y / c)
}

const EMPTY_BY_KEY: Record<MaintenanceItemKey, number> = {
  inspection: 0,
  legalInspection: 0,
  sixMonthInspection: 0,
  tax: 0,
  tires: 0,
  insurance: 0,
}

export function calculateMaintenance(
  input: MaintenanceInput,
  ctx: MaintenanceContext,
): MaintenanceResult {
  const years = Math.max(0, Math.trunc(normalizeYen(ctx.years)))

  const inspectionUnit = normalizeYen(input.inspectionCost)
  const legalUnit = normalizeYen(input.legalInspectionCost)
  const sixMonthUnit = normalizeYen(input.sixMonthInspectionCost)
  const taxUnit = normalizeYen(input.annualTax)
  const tireUnit = normalizeYen(input.tireCost)

  const inspectionCount = countInspections(years, ctx.vehicleMode)
  const legalCount = countLegalInspections(years, inspectionCount)
  const sixMonthCount = countSixMonthInspections(years)
  const taxCount = years // 毎年
  const tireCount = countTireReplacements(years, input.tireReplacementCycleYears)

  // 任意保険: 未入力('')は entered=false / total=0。includeInsurance=false でも対象外。
  const insuranceEntered =
    input.includeInsurance && typeof input.insuranceMonthly === 'number'
  const insuranceMonthly = insuranceEntered ? normalizeYen(input.insuranceMonthly) : 0
  const insuranceMonths = insuranceEntered ? years * 12 : 0
  const insuranceTotal = insuranceMonthly * insuranceMonths

  const items: MaintenanceItem[] = [
    {
      key: 'inspection',
      label: '車検',
      unitCost: inspectionUnit,
      cycleLabel:
        ctx.vehicleMode === 'new'
          ? `初回${MAINTENANCE_CYCLE.inspectionInitialYearsNew}年・以後${MAINTENANCE_CYCLE.inspectionSubsequentYears}年ごと`
          : `${MAINTENANCE_CYCLE.inspectionSubsequentYears}年ごと`,
      count: inspectionCount,
      total: inspectionUnit * inspectionCount,
      isMonthly: false,
      entered: true,
    },
    {
      key: 'legalInspection',
      label: '法定12か月点検',
      unitCost: legalUnit,
      cycleLabel: '毎年',
      count: legalCount,
      total: legalUnit * legalCount,
      isMonthly: false,
      entered: true,
    },
    {
      key: 'sixMonthInspection',
      label: '6か月点検',
      unitCost: sixMonthUnit,
      cycleLabel: '6か月ごと',
      count: sixMonthCount,
      total: sixMonthUnit * sixMonthCount,
      isMonthly: false,
      entered: true,
    },
    {
      key: 'tires',
      // 「タイヤ交換」表記は使わず必ず「夏・冬タイヤ」。
      label: '夏・冬タイヤ',
      unitCost: tireUnit,
      cycleLabel: `${Math.max(1, Math.trunc(normalizeYen(input.tireReplacementCycleYears)) || 1)}年ごと`,
      count: tireCount,
      total: tireUnit * tireCount,
      isMonthly: false,
      entered: true,
    },
    {
      key: 'tax',
      label: '自動車税',
      unitCost: taxUnit,
      cycleLabel: '毎年',
      count: taxCount,
      total: taxUnit * taxCount,
      isMonthly: false,
      entered: true,
    },
    {
      key: 'insurance',
      label: '任意保険',
      unitCost: insuranceMonthly,
      cycleLabel: '月額',
      count: insuranceMonths,
      total: insuranceTotal,
      isMonthly: true,
      entered: insuranceEntered,
    },
  ]

  const byKey: Record<MaintenanceItemKey, number> = { ...EMPTY_BY_KEY }
  for (const it of items) byKey[it.key] = it.total

  const totalExcludingInsurance =
    byKey.inspection +
    byKey.legalInspection +
    byKey.sixMonthInspection +
    byKey.tax +
    byKey.tires

  const total = totalExcludingInsurance + insuranceTotal

  return {
    items,
    total,
    totalExcludingInsurance,
    insuranceTotal,
    insuranceEntered,
    byKey,
  }
}
