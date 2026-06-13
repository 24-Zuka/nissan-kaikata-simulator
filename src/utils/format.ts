/**
 * 表示用フォーマット。
 * 金額の丸めはここでは一切行わない（計算側で確定済みの値を整形するだけ）。
 */

import { formatYen, formatYenOrBlank, normalizeYen } from '../domain/money'

export { formatYen, formatYenOrBlank }

/** 月数を「○回」表記に。 */
export function formatCount(count: number): string {
  return `${normalizeYen(count).toLocaleString('ja-JP')}回`
}

/** 「○年」表記。 */
export function formatYears(years: number): string {
  return `${normalizeYen(years).toLocaleString('ja-JP')}年`
}

/** 周期の表示。例: 2 -> "2年ごと" */
export function formatCycleYears(years: number): string {
  const y = normalizeYen(years)
  if (y <= 0) return '—'
  if (y === 1) return '毎年'
  return `${y}年ごと`
}

/**
 * 差額表示。比較概念なので符号付きで表示する。
 * 表示側で再計算しないよう、呼び出し側で確定済みの差額(整数)を渡す前提。
 */
export function formatDiff(diff: number): string {
  const sign = diff > 0 ? '+' : diff < 0 ? '−' : '±'
  const abs = Math.abs(Math.trunc(diff))
  return `${sign}${abs.toLocaleString('ja-JP')}円`
}

/** ISO日付(YYYY-MM-DD)を「YYYY年M月D日」へ。不正値は空文字。 */
export function formatDateJp(iso: string): string {
  if (!iso) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  return `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日`
}
