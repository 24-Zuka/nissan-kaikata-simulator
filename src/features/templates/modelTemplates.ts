import gradeCatalog from '../../data/fourWheelGrades.json' with { type: 'json' }
import { createInitialScenario } from '../../domain/defaults'
import type { CustomerLink, Scenario } from '../../domain/types'
import { isValidScenario } from '../../../server/scenarioSchema'
import type { StorageScope } from '../../storage/scenarioStorage'

export const LINEUP_CHECKED_AT = '2026-10-17'
export const LINEUP_SOURCE = 'https://www.nissan.co.jp/'
// Passenger names only. No catalogue prices, financing rates or lease prices are seeded.
export const MODEL_NAMES = [...new Set(gradeCatalog.map(r => r.model))]
export type TemplateTerms = Pick<Scenario, 'vehicle' | 'newMaintenance' | 'cash' | 'credit' | 'bvc' | 'omatome' | 'comparison'>
export type ModelTemplate = {
  id: string; name: string; model: string; grade: string; drive: string; updatedAt: string
  terms: TemplateTerms
}
export function createBlankScenario(): Scenario {
  const s = createInitialScenario()
  s.strictInput = true
  s.currentCar.tireCycleYears = 3
  s.newMaintenance.tireCycleYears = 3
  s.usedMaintenance.tireCycleYears = 3
  for (const m of [s.newMaintenance, s.usedMaintenance]) {
    m.inspectionCost = ''; m.legalInspectionCost = ''; m.sixMonthInspectionCost = ''
    m.tireCost = ''; m.annualTax = ''; m.monthlyInsurance = ''; m.repairCost = ''
  }
  s.credit.annualRate = ''; s.bvc.annualRate = ''
  return s
}
export function newLinkedScenario(link: CustomerLink): Scenario {
  const s = createBlankScenario()
  s.customerLink = structuredClone(link)
  s.quote.customerName = link.customerName
  s.quote.scenarioName = `${link.customerName}・${link.vehicleName}の購入比較`.slice(0, 120)
  // The PITNOTE vehicle is the current car, not the new purchase candidate.
  s.currentCar.firstRegistrationMonth = link.firstRegistrationMonth
  s.currentCar.nextInspectionMonth = link.nextInspectionMonth || ''
  return s
}
export function createTemplate(): ModelTemplate {
  const s = createBlankScenario()
  s.comparison.enabledPlans = { cash: false, credit: false, bvc: false, omatome: false }
  return templateFromScenario(s, { id: crypto.randomUUID(), name: '', model: '', grade: '', drive: '4WD' })
}
export function templateFromScenario(s: Scenario, info: Omit<ModelTemplate, 'terms' | 'updatedAt'>): ModelTemplate {
  const { vehicle, newMaintenance, cash, credit, bvc, omatome, comparison } = s
  return structuredClone({ ...info, updatedAt: new Date().toISOString(), terms: {
    vehicle: { ...vehicle, condition: 'new', tradeIn: '', usedCarPurchasePrice: '', nextInspectionMonths: '' },
    newMaintenance, cash, credit, bvc, omatome, comparison,
  } })
}
export function templateScenario(t: ModelTemplate): Scenario {
  return { ...createBlankScenario(), ...structuredClone(t.terms), quote: {
    ...createBlankScenario().quote, carName: t.model, grade: t.grade, drive: t.drive, amountStatus: 'estimate',
  } }
}
export function applyTemplate(current: Scenario, t: ModelTemplate): Scenario {
  if (!isModelTemplate(t)) throw new Error('概算設定の形式が不正です。')
  const next = templateScenario(t)
  // Only this comparison's current-car and trade-in context may survive the replacement.
  next.quote = { ...current.quote, carName: t.model, grade: t.grade, drive: t.drive, staffName: '西塚', amountStatus: 'estimate' }
  next.customerLink = current.customerLink ? structuredClone(current.customerLink) : undefined
  next.currentCar = structuredClone(current.currentCar)
  next.vehicle.tradeIn = current.vehicle.tradeIn
  next.templateSource = { id: t.id, name: t.name, updatedAt: t.updatedAt }
  return next
}
export function isModelTemplate(value: unknown): value is ModelTemplate {
  if (!value || typeof value !== 'object') return false
  const t = value as ModelTemplate
  if (![t.id, t.name, t.model, t.grade, t.drive, t.updatedAt].every(v => typeof v === 'string' && v.length <= 200)
    || !t.id || !t.name.trim() || !t.model.trim() || !t.grade.trim() || !['4WD','e-4ORCE','AWD'].includes(t.drive) || !Number.isFinite(Date.parse(t.updatedAt)) || !t.terms) return false
  return isValidScenario({ ...createBlankScenario(), ...t.terms })
    && Object.keys(t.terms).sort().join() === ['vehicle','newMaintenance','cash','credit','bvc','omatome','comparison'].sort().join()
}
export function templateStorageKey(scope?: StorageScope): string {
  return `carplan_model_templates_v1:${scope ? encodeURIComponent(scope.organizationId) + ':' + encodeURIComponent(scope.userId) : 'legacy'}`
}
export function loadTemplates(storage: Storage = localStorage, scope?: StorageScope): ModelTemplate[] {
  const raw = storage.getItem(templateStorageKey(scope))
  if (!raw) return []
  const values: unknown = JSON.parse(raw)
  if (!Array.isArray(values) || !values.every(isModelTemplate)) throw new Error('概算設定を読み込めません。元データは変更しません。')
  return values
}
export function saveTemplates(values: ModelTemplate[], storage: Storage = localStorage, scope?: StorageScope) {
  if (!values.every(isModelTemplate)) throw new Error('車種と設定名、金額・回数を確認してください。')
  storage.setItem(templateStorageKey(scope), JSON.stringify(values))
}
