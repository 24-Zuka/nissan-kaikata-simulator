import { describe, it, expect, vi } from 'vitest'
import { createBlankScenario, createTemplate, applyTemplate, templateFromScenario, isModelTemplate, saveTemplates, loadTemplates } from './modelTemplates'
import { newLinkedScenario } from './modelTemplates'
import { calculateComparison } from '../../domain/comparison'
import { calculateScenarioMaintenance } from '../../domain/maintenance'
import { createInitialScenario } from '../../domain/defaults'
import { createShareSafeScenario, migrateScenario, loadScenarios, V9_STORAGE_KEY } from '../../storage/scenarioStorage'
import { isValidScenario } from '../../../server/scenarioSchema'
import { applyPricing, type PricingReference } from '../maintenance/pricing'
import pricingCatalog from '../maintenance/pitnote-pricing.json'
import grades from '../../data/fourWheelGrades.json'

const link = {customerId:'customer-a',vehicleId:'vehicle-a',customerName:'架空 同名',vehicleName:'ノート',numberLast4:'1234',firstRegistrationMonth:'2021-01',nextInspectionMonth:'2027-03',capturedAt:'2026-10-17T12:00:00.000Z'}
function completedCash() {
 const s=createBlankScenario();s.vehicle.estimateTotal=3000000;s.vehicle.tradeIn=0
 Object.assign(s.newMaintenance,{inspectionCost:0,legalInspectionCost:0,sixMonthInspectionCost:0,tireCost:0,annualTax:0,monthlyInsurance:0,repairCost:0})
 return s
}
describe('PITNOTE integration and explicit estimates',()=>{
 it('links a minimal current-car snapshot without guessing a purchase car or amounts',()=>{
  const s=newLinkedScenario(link);expect(s.quote.customerName).toBe(link.customerName)
  expect(s.quote.staffName).toBe('西塚');expect(s.quote.carName).toBe('')
  expect(s.currentCar.nextInspectionMonth).toBe('2027-03');expect(s.vehicle.estimateTotal).toBe('')
  s.customerLink!.customerName='edited';expect(link.customerName).toBe('架空 同名')
  expect(isValidScenario(s)).toBe(true)
 })
 it('does not treat blank money as an explicit zero or publish partial totals',()=>{
  const s=completedCash();expect(calculateComparison(s).completePlans.map(p=>p.planId)).toContain('cash')
  s.newMaintenance.annualTax='';expect(calculateComparison(s).completePlans).toHaveLength(0)
  expect(s.newMaintenance.annualTax).toBe('')
 })
 it('does not compare against an incomplete current-car total',()=>{
  const s=completedCash();s.currentCar.originalPurchasePrice=2000000;s.currentCar.firstRegistrationMonth='2020-01'
  const r=calculateComparison(s);expect(r.completePlans.find(p=>p.planId==='cash')!.differenceFromStatusQuo).toBeUndefined()
 })
 it('uses a 3-year tire cycle only for new comparisons and preserves saved 4 years',()=>{
  const s=completedCash();s.newMaintenance.tireCost=100000
  expect(calculateScenarioMaintenance(s,6).breakdown.find(x=>x.id==='tires')?.count).toBe(2)
  const old=createInitialScenario();expect(migrateScenario(old).newMaintenance.tireCycleYears).toBe(4)
  expect(calculateScenarioMaintenance(old,6).breakdown.find(x=>x.id==='tires')?.count).toBe(1)
 })
 it('applies only a copied preset and keeps current customer and trade-in context',()=>{
  const current=newLinkedScenario(link);current.vehicle.tradeIn=123456
  const t=templateFromScenario(completedCash(),{id:'t1',name:'ノート4WD概算',model:'ノート',grade:'X FOUR',drive:'4WD'})
  const applied=applyTemplate(current,t)
  expect(isModelTemplate(t)).toBe(true);expect(applied.customerLink).toEqual(link)
  expect(applied.vehicle.tradeIn).toBe(123456);expect(applied.quote.amountStatus).toBe('estimate')
  expect(Object.keys(t.terms)).not.toContain('quote');expect(t.terms.vehicle.tradeIn).toBe('')
  t.terms.vehicle.estimateTotal=4000000;expect(applied.vehicle.estimateTotal).toBe(3000000)
  applied.credit.downPayment=999;expect(t.terms.credit.downPayment).toBe('')
 })
 it('leaves new presets unpriced and payment plans disabled',()=>{
  const t=createTemplate();expect(t.terms.vehicle.estimateTotal).toBe('')
  expect(Object.values(t.terms.comparison.enabledPlans)).toEqual([false,false,false,false])
 })
 it('isolates presets and legacy scenarios by authenticated account scope',()=>{
  const t=templateFromScenario(completedCash(),{id:'t1',name:'設定',model:'ノート',grade:'X FOUR',drive:'4WD'})
  const a={organizationId:'org',userId:'a'},b={organizationId:'org',userId:'b'}
  localStorage.clear();saveTemplates([t],localStorage,a);expect(loadTemplates(localStorage,b)).toEqual([])
  localStorage.setItem(V9_STORAGE_KEY,JSON.stringify([{id:'private',name:'private',scenario:createInitialScenario()}]))
  expect(loadScenarios(localStorage,b)).toEqual([])
 })
 it('preserves source amounts, blanks and linkage through migration, but removes them from shared identity',()=>{
  const s=applyPricing(newLinkedScenario(link),'newMaintenance',pricingCatalog[0] as PricingReference)
  s.templateSource={id:'t1',name:'担当者設定',updatedAt:link.capturedAt}
  expect(isValidScenario(s)).toBe(true)
  expect(migrateScenario(s).newMaintenance).toEqual(s.newMaintenance)
  expect(migrateScenario(s).customerLink).toEqual(link)
  const shared=createShareSafeScenario(s)
  expect(shared.customerLink).toBeUndefined();expect(shared.templateSource).toBeUndefined()
  expect(shared.quote.customerName).toBe('');expect(shared.quote.scenarioName).not.toContain('同名')
 })
 it('separates legal charges and never doubles the oil and filter package',()=>{
  const ref=pricingCatalog.find(r=>r.model.includes('ノート'))! as PricingReference
  let s=applyPricing(completedCash(),'newMaintenance',ref)
  expect(s.newMaintenance.inspectionLegalCost).toBe('')
  expect(calculateComparison(s).completePlans).toHaveLength(0)
  s.newMaintenance.inspectionLegalCost=55000
  const result=calculateScenarioMaintenance(s,5)
  expect(result.breakdown.find(x=>x.id==='inspection')?.unitCost).toBe(ref.results!.shaken.subtotal!+55000)
  expect(result.breakdown.find(x=>x.id==='legalInspection')?.unitCost).toBe(ref.results!.twelve.total)
  const stored=JSON.parse(s.newMaintenance.pricingSource!.detail)
  expect(stored.twelve.items.filter((x:{label:string})=>/オイル/.test(x.label))).toHaveLength(1)
  expect(stored.twelve.items.some((x:{label:string})=>/オイル＋エレメント パッケージ/.test(x.label))).toBe(true)
  expect(s.newMaintenance.annualTax).toBe(0)
 })
 it('freezes current-car timing to quote date and uses recorded next inspection',()=>{
  const s=newLinkedScenario(link);s.quote.quoteDate='2026-10-17';s.currentCar.originalPurchasePrice=1
  const first=calculateComparison(s).plans[0].maintenance
  vi.useFakeTimers();vi.setSystemTime(new Date('2030-10-17'))
  expect(calculateComparison(s).plans[0].maintenance).toEqual(first);vi.useRealTimers()
  expect(first.breakdown.find(x=>x.id==='inspection')?.cycleLabel).toContain('登録済み次回車検')
 })
 it('has unique 4WD catalogue entries with dated official sources and no prices',()=>{
  expect(new Set(grades.map(r=>r.id)).size).toBe(grades.length)
  for(const r of grades){expect(['4WD','e-4ORCE','AWD']).toContain(r.drive);expect(r.checkedAt).toBe('2026-10-17');expect(r.source).toMatch(/^https:\/\/(www2.nissan.co.jp|global.nissannews.com|lv.nissan.co.jp)\//);expect(r).not.toHaveProperty('price')}
 })
})
