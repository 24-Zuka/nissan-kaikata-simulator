import type { PlanResult } from '../domain/types'

export type ComparisonRowKey =
  | 'effectiveMonthly'
  | 'effectiveTotal'
  | 'totalPayment'
  | 'purchasePayment'
  | 'monthlyBurden'
  | 'bonusPayment'
  | 'paymentCount'
  | 'finalPayment'

export const COMPARISON_ROWS: {
  key: ComparisonRowKey
  label: string
  emphasis?: boolean
}[] = [
  { key: 'effectiveMonthly', label: '実質月額', emphasis: true },
  { key: 'effectiveTotal', label: '実質総額', emphasis: true },
  { key: 'totalPayment', label: '支払総額' },
  { key: 'purchasePayment', label: '購入時支払' },
  { key: 'monthlyBurden', label: '月あたり支払' },
  { key: 'bonusPayment', label: 'ボーナス月加算額' },
  { key: 'paymentCount', label: '支払回数' },
  { key: 'finalPayment', label: '最終回／残価' },
]

export function formatPaymentCount(plan: PlanResult): string {
  if (plan.planId === 'cash') return '一括'
  return plan.paymentCount ? `${plan.paymentCount}回` : '0回'
}

export function getResultValue(plan: PlanResult, key: ComparisonRowKey): number {
  if (key === 'purchasePayment') {
    return plan.planId === 'cash' ? plan.totalPayment : plan.initialPayment
  }
  if (key === 'monthlyBurden') {
    return plan.planId === 'cash' ? plan.monthlyEquivalent : plan.monthlyPayment
  }
  if (key === 'paymentCount') return plan.paymentCount
  return plan[key]
}

export function getPlanRowLabel(
  plan: PlanResult,
  key: ComparisonRowKey,
  fallback: string,
): string {
  if (key === 'purchasePayment') {
    if (plan.planId === 'cash') return '一括支払'
    if (plan.planId === 'statusQuo') return '過去購入額等'
    return '頭金・初回支払'
  }
  if (key === 'monthlyBurden') {
    return plan.planId === 'cash' ? '月々換算' : '月々の支払'
  }
  return fallback
}
