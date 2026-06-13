/**
 * 車両見積の共通計算（純粋関数・リーフモジュール）
 *
 * 二重控除を避けるため、下取り控除は1箇所でのみ適用する。
 */

import type { Scenario } from './types'
import { clampYen, normalizeYen } from './money'

export type VehicleEstimate = {
  /** 車両見積総額 = 本体 + オプション + 諸費用 - 値引き */
  grossTotal: number
  /** 下取り控除（0〜grossTotal にクランプ済み） */
  tradeIn: number
  /** 支払対象総額 = grossTotal - tradeIn */
  payableTotal: number
}

export function calcVehicleEstimate(scenario: Scenario): VehicleEstimate {
  const vehiclePrice = normalizeYen(scenario.vehiclePrice)
  const optionPrice = normalizeYen(scenario.optionPrice)
  const taxAndFees = normalizeYen(scenario.taxAndFees)
  const discount = normalizeYen(scenario.discount)

  // 値引きが本体+OP+諸費用を超えても負数にしない。
  const grossTotal = Math.max(0, vehiclePrice + optionPrice + taxAndFees - discount)

  // 下取りは 0〜車両見積総額 にクランプ（二重控除・過剰控除を防ぐ）。
  const tradeIn = clampYen(scenario.tradeIn, 0, grossTotal)

  const payableTotal = Math.max(0, grossTotal - tradeIn)

  return { grossTotal, tradeIn, payableTotal }
}
