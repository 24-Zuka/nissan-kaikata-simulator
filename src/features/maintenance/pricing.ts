import type { Scenario } from '../../domain/types'
export type PricingReference = { model: string; available: boolean; reason?: string; masterVersion?: string; codes?: string; inspectionClass?: string; results?: { six: Assessment; twelve: Assessment; shaken: Assessment } }
type Assessment = { total: number | null; subtotal: number | null; reasons: string[]; notes: string[]; items: { label: string; amount: number }[]; draft: object }
export function applyPricing(s: Scenario, section: 'currentCar' | 'newMaintenance' | 'usedMaintenance', r: PricingReference): Scenario {
  if (!r.available || !r.results) throw new Error('適用できる料金がありません。')
  const {six,twelve,shaken} = r.results
  return { ...s, strictInput: true, quote: {...s.quote,amountStatus:'estimate'}, [section]: {
    ...s[section], sixMonthInspectionCost: six.total ?? '', legalInspectionCost: twelve.total ?? '',
    inspectionCost: '', inspectionServiceCost: shaken.subtotal ?? '', inspectionLegalCost: '',
    pricingSource: { model:r.model,masterVersion:r.masterVersion||'',codes:r.codes||'',appliedAt:new Date().toISOString(),detail:JSON.stringify(r.results) },
  } }
}
