import type { PlanId, Scenario } from './types'
const costLabels = {
  inspectionCost: '車検費用', legalInspectionCost: '法定点検', sixMonthInspectionCost: '6か月点検',
  tireCost: 'タイヤ代', annualTax: '年税額', repairCost: '修理費',
} as const
export function strictMissingFields(s: Scenario, plan: PlanId): string[] {
  const missing: string[] = []
  const check = (value: unknown, label: string) => { if (value === '' || value === undefined) missing.push(label) }
  const m = plan === 'statusQuo' ? s.currentCar
    : (plan === 'cash' || plan === 'credit') && s.vehicle.condition === 'used' ? s.usedMaintenance : s.newMaintenance
  if (m.inspectionServiceCost !== undefined) { check(m.inspectionServiceCost, '車検整備料'); check(m.inspectionLegalCost, '車検法定費用等') }
  for (const [key, label] of Object.entries(costLabels)) { if (key !== 'inspectionCost' || m.inspectionServiceCost === undefined) check(m[key as keyof typeof costLabels], label) }
  if (plan === 'statusQuo' || ('includeInsurance' in m && m.includeInsurance)) check(m.monthlyInsurance, '任意保険')
  if (plan === 'statusQuo') {
    check(s.currentCar.firstRegistrationMonth, '初度登録年月')
    check(s.currentCar.originalPurchasePrice, '過去の購入額')
    check(s.currentCar.remainingDebt, '残債')
    check(s.currentCar.monthlyPayment, '月の支払額')
    check(s.currentCar.remainingPayments, '残りローン回数')
    return missing
  }
  check(s.vehicle.tradeIn, '下取り')
  if ((plan === 'cash' || plan === 'credit') && s.vehicle.condition === 'used') check(s.vehicle.nextInspectionMonths, '次回車検まで')
  if (plan !== 'cash') {
    const p = s[plan]
    check(p.downPayment, '頭金'); check(p.bonusPayment, 'ボーナス')
    // Blank monthly + first payment is the explicit existing interest calculation mode.
    if (p.monthlyPayment !== '') check(p.firstPayment, '初回支払額')
    if (plan === 'omatome' && s.omatome.selectedMode === 'purchase') check(s.omatome.finalPayment, '最終回')
  }
  return missing
}
