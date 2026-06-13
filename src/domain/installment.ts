/**
 * 分割払いエンジン（元利均等方式・純粋関数）
 *
 * NFS（日産フィナンシャルサービス）の支払予定表の構造を再現するための共通エンジン。
 * クレジット / BVC / おまとめ で共有する。
 *
 * モデル方針:
 * - 実質年率・元利均等方式。月利 i = 年率% / 100 / 12。
 * - 理論月額は年金現価係数の閉形式で求める。
 * - 2回目以降の均等月額は ROUNDING_CONFIG.monthlyPayment（1円・切り捨て）で丸める。
 * - 支払総額は ROUNDING_CONFIG.totalPayment（1円・四捨五入）で確定し、
 *   端数は初回支払額で吸収して「支払予定の総和 = 支払総額」を1円単位で成立させる。
 * - BVC残価は最終回の据置（バルーン）として扱い、利息は残価を含む元金全体に発生させる
 *   （残価を月額の按分対象から外すために残価の現在価値を差し引くが、
 *    残価分の利息は支払総額に内包される）。
 *
 * TODO(SPEC): ボーナス加算分の按分（現在価値の取り方）、初回 vs 2回目以降の丸め配分は
 *             NFSの支払予定表と突合して校正する。現状は中点割引で近似している。
 */

import Decimal from 'decimal.js'
import { ROUNDING_CONFIG, normalizeYen, floorYen, roundYen } from './money'

/** 月利を Decimal で返す。年率%（例 3.9）→ 月利。 */
function monthlyRate(annualRate: number): Decimal {
  const r = new Decimal(Math.max(0, annualRate || 0))
  return r.div(100).div(12)
}

/**
 * 年金現価係数による理論月額（Decimal）。
 * i=0 は単純割り。principal<=0 / months<=0 は 0。
 */
export function annuityMonthly(principal: Decimal, months: number, i: Decimal): Decimal {
  if (principal.lte(0) || months <= 0) return new Decimal(0)
  if (i.lte(0)) return principal.div(months)
  const factor = i.plus(1).pow(months) // (1+i)^n
  return principal.mul(i).mul(factor).div(factor.minus(1))
}

/**
 * 指定の定額月額で、元利が期間内に完済できるか判定する純粋関数。
 * 毎月: 残高 = 残高 × (1+i) − monthly。最終的に残高 ≤ 0 なら完済可能。
 * 退化ケース（元金0・回数0）は true（支払うものが無い）。
 */
export function canRepay(
  monthly: number,
  principal: number,
  months: number,
  annualRate: number,
): boolean {
  const P = normalizeYen(principal)
  const n = Math.max(0, Math.trunc(normalizeYen(months)))
  const m = normalizeYen(monthly)
  if (P <= 0) return true
  if (n <= 0) return false
  const i = monthlyRate(annualRate)
  let balance = new Decimal(P)
  for (let k = 0; k < n; k++) {
    balance = balance.mul(i.plus(1)).minus(m)
    if (balance.lte(0)) return true
  }
  return balance.lte(0)
}

/**
 * 定額で完済できる最小の整数月額を求める（canRepayの単調性を利用）。
 * 主にテスト・検算用。閉形式の理論値を初期値に、上下限と反復上限ガードを設ける。
 */
export function findMinimalMonthly(
  principal: number,
  months: number,
  annualRate: number,
): number {
  const P = normalizeYen(principal)
  const n = Math.max(0, Math.trunc(normalizeYen(months)))
  if (P <= 0 || n <= 0) return 0
  const i = monthlyRate(annualRate)
  const theoretical = annuityMonthly(new Decimal(P), n, i)
  const lo = Math.max(0, floorYen(theoretical) - 2)
  // 上限: 理論値+数円、または元金（極端ケース）。
  const hi = Math.max(lo + 5, Math.min(P, floorYen(theoretical) + 5))
  // 上限が完済不能なら元金まで広げる安全網。
  let upper = hi
  if (!canRepay(upper, P, n, annualRate)) upper = P
  // 線形（範囲が狭いため）→ 念のため二分探索。
  let lowBound = lo
  let highBound = upper
  let guard = 0
  while (lowBound < highBound && guard < 64) {
    const mid = Math.floor((lowBound + highBound) / 2)
    if (canRepay(mid, P, n, annualRate)) {
      highBound = mid
    } else {
      lowBound = mid + 1
    }
    guard++
  }
  return lowBound
}

export type InstallmentParams = {
  /** 分割対象元金（支払対象総額 − 頭金）。BVCは残価を含む全体。 */
  principal: number
  months: number
  annualRate: number
  /** 残価（BVCの最終回据置額）。無ければ0。 */
  residual?: number
  /** 残価を支払総額に含めるか（買取=true / 返却=false / 通常クレジット=true かつ residual=0）。 */
  includeResidualInTotal?: boolean
  bonusPayment?: number
  bonusMonths?: number[]
}

export type InstallmentResult = {
  principal: number
  residual: number
  /** 初回支払額（端数調整済み） */
  initialPayment: number
  /** 2回目以降の均等月額 */
  equalMonthly: number
  /** 月額支払の回数（= months） */
  monthlyCount: number
  /** 月々支払の総和（初回 + 均等×(months-1)） */
  monthlyScheduleTotal: number
  bonusPayment: number
  bonusCount: number
  bonusTotal: number
  /** 最終回支払額（= 残価。返却時も金額として把握できるよう保持） */
  finalPayment: number
  /** 支払総額（= 月々総和 + ボーナス総和 + (買取時のみ残価)） */
  totalPayment: number
  /** 金利手数料（= 支払総額 − 実際に支払う元金）。非負。 */
  interestFee: number
}

/** ボーナス加算回数。floor(months/12) × 有効ボーナス月数。 */
function countBonusOccurrences(months: number, bonusMonths: number[] | undefined): number {
  if (!bonusMonths || bonusMonths.length === 0) return 0
  const valid = new Set(bonusMonths.map((m) => Math.trunc(m)).filter((m) => m >= 1 && m <= 12))
  const years = Math.floor(Math.max(0, months) / 12)
  // TODO(SPEC): 端数月（12未満の残り）にボーナス月が来るかは開始月依存のため未考慮。
  return years * valid.size
}

const emptyResult = (principal: number, residual: number): InstallmentResult => ({
  principal,
  residual,
  initialPayment: 0,
  equalMonthly: 0,
  monthlyCount: 0,
  monthlyScheduleTotal: 0,
  bonusPayment: 0,
  bonusCount: 0,
  bonusTotal: 0,
  finalPayment: residual,
  totalPayment: 0,
  interestFee: 0,
})

export function computeInstallment(params: InstallmentParams): InstallmentResult {
  const principal = normalizeYen(params.principal)
  const months = Math.max(0, Math.trunc(normalizeYen(params.months)))
  const residual = normalizeYen(params.residual)
  const includeResidual = params.includeResidualInTotal ?? true
  const bonusPaymentInput = normalizeYen(params.bonusPayment)

  // 退化ケース: 元金0 or 回数0 → 0円系列。
  if (principal <= 0 || months <= 0) {
    return emptyResult(principal, residual)
  }

  const i = monthlyRate(params.annualRate)

  // ボーナス回数・総額
  const bonusCount = bonusPaymentInput > 0 ? countBonusOccurrences(months, params.bonusMonths) : 0
  const bonusTotal = bonusPaymentInput * bonusCount

  // 残価の現在価値（残価分は月額按分から外す。利息は totalPayment に内包）。
  const residualPV = residual > 0 ? new Decimal(residual).div(i.plus(1).pow(months)) : new Decimal(0)

  // ボーナス分の現在価値（中点割引で近似）。
  let bonusPV = new Decimal(0)
  if (bonusTotal > 0) {
    if (i.lte(0)) {
      bonusPV = new Decimal(bonusTotal)
    } else {
      const midMonth = months / 2
      bonusPV = new Decimal(bonusTotal).div(i.plus(1).pow(midMonth))
    }
  }

  // 月額が按分すべき元金 = 元金 − 残価PV − ボーナスPV（負にしない）。
  let monthlyPrincipal = new Decimal(principal).minus(residualPV).minus(bonusPV)
  if (monthlyPrincipal.lt(0)) monthlyPrincipal = new Decimal(0)

  const theoretical = annuityMonthly(monthlyPrincipal, months, i)

  // 2回目以降の均等月額（切り捨て）。
  const equalMonthly =
    ROUNDING_CONFIG.monthlyPayment.mode === 'floor' ? floorYen(theoretical) : roundYen(theoretical)

  // 月々支払総和（四捨五入）。端数は初回で吸収する。
  const monthlyScheduleTotal = roundYen(theoretical.mul(months))

  let initialPayment = monthlyScheduleTotal - equalMonthly * (months - 1)
  if (initialPayment < 0) {
    // 念のための安全網（通常は均等月額が理論値以下のため発生しない）。
    initialPayment = 0
  }

  const residualPaidTotal = includeResidual ? residual : 0
  const totalPayment = monthlyScheduleTotal + bonusTotal + residualPaidTotal

  const principalPaid = includeResidual ? principal : Math.max(0, principal - residual)
  const interestFee = Math.max(0, totalPayment - principalPaid)

  return {
    principal,
    residual,
    initialPayment,
    equalMonthly,
    monthlyCount: months,
    monthlyScheduleTotal,
    bonusPayment: bonusPaymentInput,
    bonusCount,
    bonusTotal,
    finalPayment: residual,
    totalPayment,
    interestFee,
  }
}

export { Decimal }
