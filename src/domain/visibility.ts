/**
 * 現状維持プランの表示条件（React非依存の純粋関数）。
 *
 * 現状維持は、現在の車の「過去購入額」または「月の支払額」が入力された場合のみ、
 * 比較対象として意味を持つため表示する。
 * （未入力なら、比較表・印刷・お客様説明モードのいずれにも現状維持を出さない。）
 */

import type { CurrentCarInput } from './types'
import { normalizeYen } from './money'

export type StatusQuoVisibility = {
  showInDetailComparison: boolean
  showInPrintComparison: boolean
  showInCustomerPresentation: boolean
  showInDifferenceComparison: boolean
  showPastPurchasePriceRow: boolean
}

/**
 * 表示条件判定。
 * originalPurchasePrice > 0 || monthlyPayment > 0 の場合のみ true。
 */
export function getStatusQuoVisibility(currentCar: CurrentCarInput): StatusQuoVisibility {
  const originalPrice = normalizeYen(currentCar?.originalPurchasePrice)
  const monthlyPayment = normalizeYen(currentCar?.monthlyPayment)
  const visible = originalPrice > 0 || monthlyPayment > 0

  return {
    showInDetailComparison: visible,
    showInPrintComparison: visible,
    showInCustomerPresentation: visible,
    showInDifferenceComparison: visible,
    // 過去購入額の行は、過去購入額が入力されているときのみ。
    showPastPurchasePriceRow: originalPrice > 0,
  }
}
