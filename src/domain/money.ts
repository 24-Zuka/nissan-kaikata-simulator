/**
 * 金額処理ユーティリティ（単一の金額基盤）
 *
 * 設計原則:
 * - 途中計算は Decimal.js のまま連鎖させ、toNumber() は返却直前の1回に限定する。
 * - 公開する金額返却値はすべて「有限・非負・整数の number」を保証する。
 * - NaN / Infinity / -Infinity / 負数 / 非数 は 0 へ黙ってフォールバックする
 *   （商談中にクラッシュ・異常表示を出さないため）。本番ビルドで警告UIは出さない。
 * - 開発ビルドのみ console.warn で通知する。
 */

import Decimal from 'decimal.js'

// 金融計算に十分な精度を確保。
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP })

/**
 * 丸め設定。
 *
 * この丸め設定は、NFS（日産フィナンシャルサービス）の支払予定表との突合で
 * 校正するパラメータである。実データ取得後、unit / mode を支払予定表に合わせて調整する。
 *
 * 初期値:
 * - monthlyPayment: 1円単位・切り捨て（floor）
 * - totalPayment / effectiveTotal: 1円単位・四捨五入（round）
 * - firstPaymentAdjustment: 初回支払額で端数を吸収し、総和を1円単位で一致させる。
 */
export const ROUNDING_CONFIG = {
  monthlyPayment: {
    unit: 1,
    mode: 'floor',
  },
  totalPayment: {
    unit: 1,
    mode: 'round',
  },
  effectiveTotal: {
    unit: 1,
    mode: 'round',
  },
  firstPaymentAdjustment: {
    enabled: true,
  },
} as const

const isDev = Boolean(import.meta.env?.DEV)

function devWarn(message: string, value: unknown): void {
  if (isDev) {
    // 開発時のみ。本番では何も出さない。
    // eslint-disable-next-line no-console
    console.warn(`[money] ${message}:`, value)
  }
}

/** unknown を Decimal へ安全に変換する。失敗時は null。 */
function toDecimalSafe(value: unknown): Decimal | null {
  if (value instanceof Decimal) {
    return value.isFinite() ? value : null
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    return new Decimal(value)
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') return null
    try {
      const d = new Decimal(trimmed)
      return d.isFinite() ? d : null
    } catch {
      return null
    }
  }
  return null
}

/**
 * 有限・非負・整数の number へ正規化する。
 * NaN / Infinity / 負数 / 非数 / 空文字 は 0 にフォールバックする。
 * 小数は切り捨て（floor）。
 * TODO(SPEC): 小数の扱い（切り捨て / 0化 / 四捨五入）は既存仕様が無いため切り捨てを採用。
 *             NFS突合時に確定する。
 */
export function normalizeYen(value: unknown): number {
  const d = toDecimalSafe(value)
  if (d === null) {
    if (value !== '' && value !== null && value !== undefined) {
      devWarn('normalizeYen fallback to 0', value)
    }
    return 0
  }
  if (d.isNegative()) {
    devWarn('normalizeYen negative -> 0', value)
    return 0
  }
  return d.floor().toNumber()
}

/**
 * 未入力許容版。'' / null / undefined は '' のまま返す。
 * それ以外は normalizeYen と同じく非負整数へ正規化する。
 * 任意保険のような未入力許容項目で使用する。
 */
export function normalizeOptionalYen(value: unknown): number | '' {
  if (value === '' || value === null || value === undefined) return ''
  return normalizeYen(value)
}

/** 範囲制限。min/max も正規化し、min<=max を保証する。 */
export function clampYen(value: unknown, min: number, max: number): number {
  const v = normalizeYen(value)
  const lo = normalizeYen(min)
  const hiRaw = normalizeYen(max)
  const hi = hiRaw < lo ? lo : hiRaw
  if (v < lo) return lo
  if (v > hi) return hi
  return v
}

/** Decimal を非負整数へ。切り捨て。 */
export function floorYen(value: Decimal): number {
  if (!value.isFinite() || value.isNegative()) return 0
  return value.floor().toNumber()
}

/** Decimal を非負整数へ。四捨五入。 */
export function roundYen(value: Decimal): number {
  if (!value.isFinite() || value.isNegative()) return 0
  return value.toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber()
}

/** Decimal を非負整数へ。切り上げ。 */
export function ceilYen(value: Decimal): number {
  if (!value.isFinite() || value.isNegative()) return 0
  return value.ceil().toNumber()
}

/** 金額を日本円表記の文字列にする。例: 1234567 -> "1,234,567円" */
export function formatYen(value: number): string {
  const n = normalizeYen(value)
  return `${n.toLocaleString('ja-JP')}円`
}

/** 未入力許容版のフォーマット。'' は「未入力」を表す空文字相当として扱う。 */
export function formatYenOrBlank(value: number | ''): string {
  if (value === '' || value === null || value === undefined) return '—'
  return formatYen(value as number)
}

export { Decimal }
