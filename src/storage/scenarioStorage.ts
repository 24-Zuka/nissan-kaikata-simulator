import { createInitialScenario, SCHEMA_VERSION } from '../domain/defaults'
import {
  BVC_PAYMENT_COUNTS,
  normalizePaymentCount,
  normalizePurchaseMaintenanceYears,
  OMATOME_PAYMENT_COUNTS,
  paymentCountToYears,
} from '../domain/planTerms'
import type { MaintenanceInput, SavedScenario, Scenario } from '../domain/types'

export const STORAGE_KEY = 'nissan_purchase_comparison_v11'
export const V10_STORAGE_KEY = 'nissan_purchase_comparison_v10'
export const V9_STORAGE_KEY = 'nissan_purchase_comparison_v9'
export const V8_STORAGE_KEY = 'nissan_purchase_comparison_v8'
export const V7_STORAGE_KEY = 'nissan_purchase_comparison_v7'
export const V6_STORAGE_KEY = 'nissan_purchase_comparison_v6'
export const V5_STORAGE_KEY = 'nissan_purchase_comparison_v5'
export const V4_STORAGE_KEY = 'nissan_purchase_comparison_v4'
export const V3_STORAGE_KEY = 'nissan_purchase_comparison_v3'
export const LEGACY_STORAGE_KEY = 'nissan_purchase_comparison_v2'

export type StorageScope = {
  organizationId: string
  userId: string
}

export function scenarioStorageKey(scope?: StorageScope): string {
  if (!scope) return STORAGE_KEY
  return `${STORAGE_KEY}:${encodeURIComponent(scope.organizationId)}:${encodeURIComponent(scope.userId)}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validMonths(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.min(240, Math.max(1, Math.floor(value)))
}

function validYears(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.min(20, Math.max(1, Math.round(value)))
}

function yearsFromMonths(value: unknown): number | null {
  const months = validMonths(value)
  return months === null ? null : validYears(months / 12)
}

function moneyValue(value: unknown): number | '' {
  if (value === '') return ''
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : ''
}

function registrationMonthValue(value: unknown): string {
  if (typeof value !== 'string') return ''
  const match = value.match(/^(\d{4})-(\d{2})$/)
  if (!match) return ''
  const month = Number(match[2])
  return month >= 1 && month <= 12 ? value : ''
}

function mergeKnown<T extends object>(
  initial: T,
  value: Record<string, unknown>,
): T {
  const next = { ...initial }
  for (const key of Object.keys(initial) as (keyof T)[]) {
    if (key in value) next[key] = value[key as string] as T[keyof T]
  }
  return next
}

function migrateMaintenanceInput(
  initial: MaintenanceInput,
  value: Record<string, unknown>,
  repairFallback: unknown,
): MaintenanceInput {
  return {
    ...mergeKnown(initial, value),
    tireCycleYears:
      validYears(value.tireCycleYears) ??
      yearsFromMonths(value.tireCycleMonths) ?? 4,
    repairCost: moneyValue(
      value.repairCost === '' && repairFallback !== undefined
        ? repairFallback
        : value.repairCost ?? repairFallback,
    ),
  }
}

export function migrateScenario(value: unknown): Scenario {
  const initial = createInitialScenario()
  if (!isRecord(value)) return initial
  const sourceVersion = typeof value.schemaVersion === 'number' ? value.schemaVersion : 0

  const maintenanceValue = isRecord(value.maintenance) ? value.maintenance : {}
  const comparisonValue = isRecord(value.comparison) ? value.comparison : {}
  const enabledPlansValue = isRecord(comparisonValue.enabledPlans)
    ? comparisonValue.enabledPlans
    : {}
  const newMaintenanceValue = isRecord(value.newMaintenance)
    ? value.newMaintenance
    : maintenanceValue
  const usedMaintenanceValue = isRecord(value.usedMaintenance)
    ? value.usedMaintenance
    : maintenanceValue
  const quoteValue = isRecord(value.quote) ? value.quote : {}
  const vehicleValue = isRecord(value.vehicle) ? value.vehicle : {}
  const currentCarValue = isRecord(value.currentCar) ? value.currentCar : {}
  const cashValue = isRecord(value.cash) ? value.cash : {}
  const creditValue = isRecord(value.credit) ? value.credit : {}
  const bvcValue = isRecord(value.bvc) ? value.bvc : {}
  const omatomeValue = isRecord(value.omatome) ? value.omatome : {}
  const legacyMonths = validMonths(maintenanceValue.comparisonMonths) ?? 60
  const legacyEstimateTotal = Math.max(
    0,
    Number(vehicleValue.basePrice || 0) +
      Number(vehicleValue.optionPrice || 0) +
      Number(vehicleValue.taxAndFees || 0) -
      Number(vehicleValue.discount || 0),
  )
  const hasLegacyEstimateParts = [
    vehicleValue.basePrice,
    vehicleValue.optionPrice,
    vehicleValue.taxAndFees,
    vehicleValue.discount,
  ].some((part) => part !== undefined && part !== '')
  const powertrain = vehicleValue.powertrain === 'hybrid'
    ? 'e-power'
    : ['gasoline', 'e-power', 'e-4orce', 'ev'].includes(String(vehicleValue.powertrain))
      ? vehicleValue.powertrain
      : initial.vehicle.powertrain
  const bvcPaymentCount = normalizePaymentCount(
    bvcValue.paymentCount,
    BVC_PAYMENT_COUNTS,
  )
  const bvcMinimumYears = paymentCountToYears(bvcPaymentCount)
  const omatomePaymentCount = normalizePaymentCount(
    omatomeValue.paymentCount,
    OMATOME_PAYMENT_COUNTS,
  )
  const omatomeMinimumYears = paymentCountToYears(omatomePaymentCount)

  return {
    ...initial,
    schemaVersion: SCHEMA_VERSION,
    comparison: {
      enabledPlans: {
        cash: typeof enabledPlansValue.cash === 'boolean'
          ? enabledPlansValue.cash
          : typeof cashValue.enabled === 'boolean'
            ? cashValue.enabled
            : true,
        credit: typeof enabledPlansValue.credit === 'boolean' ? enabledPlansValue.credit : true,
        bvc: typeof enabledPlansValue.bvc === 'boolean' ? enabledPlansValue.bvc : true,
        omatome: typeof enabledPlansValue.omatome === 'boolean'
          ? enabledPlansValue.omatome
          : true,
      },
    },
    quote: mergeKnown(initial.quote, quoteValue),
    vehicle: {
      ...mergeKnown(initial.vehicle, vehicleValue),
      estimateTotal:
        'estimateTotal' in vehicleValue
          ? moneyValue(vehicleValue.estimateTotal)
          : moneyValue(hasLegacyEstimateParts ? legacyEstimateTotal : ''),
      usedCarPurchasePrice: moneyValue(vehicleValue.usedCarPurchasePrice),
      powertrain: powertrain as Scenario['vehicle']['powertrain'],
    },
    currentCar: {
      ...mergeKnown(initial.currentCar, currentCarValue),
      currentMaintenanceYears:
        validYears(currentCarValue.currentMaintenanceYears) ??
        yearsFromMonths(currentCarValue.currentMaintenanceMonths) ??
        validYears(legacyMonths / 12) ?? 5,
      firstRegistrationMonth: registrationMonthValue(
        currentCarValue.firstRegistrationMonth,
      ),
      repairCost: moneyValue(
        sourceVersion < 10
          ? maintenanceValue.currentRepairCost ??
            maintenanceValue.repairCost ??
            currentCarValue.repairCost
          : currentCarValue.repairCost,
      ),
      tireCycleYears:
        validYears(currentCarValue.tireCycleYears) ??
        yearsFromMonths(currentCarValue.tireCycleMonths) ?? 4,
    },
    newMaintenance: migrateMaintenanceInput(
      initial.newMaintenance,
      newMaintenanceValue,
      sourceVersion < 10
        ? maintenanceValue.newRepairCost ?? maintenanceValue.repairCost
        : undefined,
    ),
    usedMaintenance: migrateMaintenanceInput(
      initial.usedMaintenance,
      usedMaintenanceValue,
      sourceVersion < 10
        ? maintenanceValue.usedRepairCost ?? maintenanceValue.repairCost
        : undefined,
    ),
    cash: {
      ...mergeKnown(initial.cash, cashValue),
      cashMaintenanceYears:
        validYears(cashValue.cashMaintenanceYears) ??
        yearsFromMonths(cashValue.cashMaintenanceMonths) ??
        validYears(legacyMonths / 12) ?? 5,
    },
    credit: {
      ...mergeKnown(initial.credit, creditValue),
      firstPayment: moneyValue(creditValue.firstPayment),
      monthlyPayment: moneyValue(creditValue.monthlyPayment),
      creditMaintenanceYears:
        validYears(creditValue.creditMaintenanceYears) ??
        yearsFromMonths(creditValue.creditMaintenanceMonths) ??
        yearsFromMonths(creditValue.paymentCount) ??
        validYears(legacyMonths / 12) ?? 5,
    },
    bvc: {
      ...mergeKnown(initial.bvc, bvcValue),
      firstPayment: moneyValue(bvcValue.firstPayment),
      monthlyPayment: moneyValue(bvcValue.monthlyPayment),
      paymentCount: bvcPaymentCount,
      selectedMode: ['return', 'purchase'].includes(String(bvcValue.selectedMode))
        ? bvcValue.selectedMode as Scenario['bvc']['selectedMode']
        : 'return',
      bvcMaintenanceYears: normalizePurchaseMaintenanceYears(
        validYears(bvcValue.bvcMaintenanceYears) ??
        yearsFromMonths(bvcValue.bvcMaintenanceMonths) ??
        yearsFromMonths(bvcValue.paymentCount) ??
        validYears(legacyMonths / 12) ?? bvcMinimumYears,
        bvcMinimumYears,
      ),
    },
    omatome: {
      ...mergeKnown(initial.omatome, omatomeValue),
      paymentCount: omatomePaymentCount,
      selectedMode: sourceVersion < 6
        ? 'purchase'
        : ['return', 'purchase'].includes(String(omatomeValue.selectedMode))
          ? omatomeValue.selectedMode as Scenario['omatome']['selectedMode']
          : 'return',
      omatomeMaintenanceYears: normalizePurchaseMaintenanceYears(
        validYears(omatomeValue.omatomeMaintenanceYears) ??
        yearsFromMonths(omatomeValue.omatomeMaintenanceMonths) ??
        yearsFromMonths(omatomeValue.paymentCount) ??
        validYears(legacyMonths / 12) ?? omatomeMinimumYears,
        omatomeMinimumYears,
      ),
      included: {
        inspection: true,
        legalInspection: true,
        sixMonthInspection: true,
        tires: true,
        tax: true,
        insurance:
          isRecord(omatomeValue.included)
          && typeof omatomeValue.included.insurance === 'boolean'
            ? omatomeValue.included.insurance
            : false,
      },
    },
  } as Scenario
}

export function loadScenarios(
  storage: Storage = localStorage,
  scope?: StorageScope,
): SavedScenario[] {
  try {
    const raw = storage.getItem(scenarioStorageKey(scope)) ??
      (!scope ? storage.getItem(V10_STORAGE_KEY) : null) ??
      storage.getItem(V9_STORAGE_KEY) ??
      storage.getItem(V8_STORAGE_KEY) ??
      storage.getItem(V7_STORAGE_KEY) ??
      storage.getItem(V6_STORAGE_KEY) ??
      storage.getItem(V5_STORAGE_KEY) ??
      storage.getItem(V4_STORAGE_KEY) ??
      storage.getItem(V3_STORAGE_KEY) ??
      storage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter(isRecord)
      .map((item): SavedScenario | null => {
        if (typeof item.id !== 'string' || !item.id) return null
        return {
          id: item.id,
          name:
            typeof item.name === 'string' && item.name.trim()
              ? item.name
              : '名称未設定',
          updatedAt:
            typeof item.updatedAt === 'string'
              ? item.updatedAt
              : new Date(0).toISOString(),
          scenario: migrateScenario(item.scenario),
          organizationId:
            typeof item.organizationId === 'string' ? item.organizationId : undefined,
          ownerUserId:
            typeof item.ownerUserId === 'string' || item.ownerUserId === null
              ? item.ownerUserId
              : undefined,
          ownerName: typeof item.ownerName === 'string' ? item.ownerName : undefined,
          createdBy: typeof item.createdBy === 'string' ? item.createdBy : undefined,
          updatedBy: typeof item.updatedBy === 'string' ? item.updatedBy : undefined,
          serverUpdatedAt:
            typeof item.serverUpdatedAt === 'string' ? item.serverUpdatedAt : undefined,
          revision: typeof item.revision === 'number' ? item.revision : undefined,
        }
      })
      .filter((item): item is SavedScenario => item !== null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  } catch {
    return []
  }
}

export function saveScenario(
  scenario: Scenario,
  existingId?: string,
  storage: Storage = localStorage,
  scope?: StorageScope,
): SavedScenario {
  const scenarios = loadScenarios(storage, scope)
  const id = existingId || crypto.randomUUID()
  const existing = scenarios.find((item) => item.id === id)
  const saved: SavedScenario = {
    ...existing,
    id,
    name: scenario.quote.scenarioName.trim() || '名称未設定',
    updatedAt: new Date().toISOString(),
    scenario: migrateScenario(scenario),
  }
  const next = [saved, ...scenarios.filter((item) => item.id !== id)]

  storage.setItem(scenarioStorageKey(scope), JSON.stringify(next))
  return saved
}

export function deleteScenario(
  id: string,
  storage: Storage = localStorage,
  scope?: StorageScope,
): SavedScenario[] {
  const next = loadScenarios(storage, scope).filter((item) => item.id !== id)
  storage.setItem(scenarioStorageKey(scope), JSON.stringify(next))
  return next
}

export function replaceScenarios(
  scenarios: SavedScenario[],
  storage: Storage = localStorage,
  scope?: StorageScope,
): SavedScenario[] {
  const normalized = scenarios
    .map((item) => ({ ...item, scenario: migrateScenario(item.scenario) }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  storage.setItem(scenarioStorageKey(scope), JSON.stringify(normalized))
  return normalized
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return window
    .btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function fromBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
  const binary = window.atob(padded)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function createShareSafeScenario(scenario: Scenario): Scenario {
  return {
    ...scenario,
    schemaVersion: SCHEMA_VERSION,
    quote: {
      ...scenario.quote,
      customerName: '',
      staffName: '',
    },
  }
}

export function encodeSharedScenario(scenario: Scenario): string {
  return toBase64Url(JSON.stringify(createShareSafeScenario(scenario)))
}

export function decodeSharedScenario(value: string): Scenario | null {
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(value))
    if (!isRecord(parsed)) return null
    return migrateScenario(parsed)
  } catch {
    return null
  }
}

export function getScenarioFromHash(hash: string): Scenario | null {
  const match = hash.match(/^#share=([A-Za-z0-9_-]+)$/)
  return match ? decodeSharedScenario(match[1]) : null
}
