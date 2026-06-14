/**
 * 共有データ（JSONエクスポート / インポート / 共有URL）。
 *
 * 個人情報の扱い:
 * - 共有URL生成時は既定で個人情報（顧客名・担当者名）を除去する。
 * - 不正な共有データは安全に無視する（例外を投げない）。
 */

import { createDefaultScenario } from '../domain/constants'
import type { Scenario } from '../domain/types'

/** UTF-8対応の base64 エンコード。 */
function toBase64(str: string): string {
  try {
    const bytes = new TextEncoder().encode(str)
    let bin = ''
    bytes.forEach((b) => (bin += String.fromCharCode(b)))
    return btoa(bin)
  } catch {
    return ''
  }
}

function fromBase64(b64: string): string | null {
  try {
    const bin = atob(b64)
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

/** 個人情報を除去したコピーを返す。 */
export function stripPersonalInfo(scenario: Scenario): Scenario {
  return { ...scenario, customerName: '', staffName: '' }
}

/**
 * 任意の解析済みデータを、欠損キーを既定値で補完して安全な Scenario にする。
 * ネストしたオブジェクト（currentCar/maintenance/各プラン）も既定値で1段マージし、
 * 旧バージョン・部分データの読込でクラッシュしないようにする（保存データ移行の安全網）。
 */
export function mergeScenarioDefaults(parsed: unknown): Scenario {
  const base = createDefaultScenario()
  if (!parsed || typeof parsed !== 'object') return base
  const p = parsed as Partial<Scenario>
  return {
    ...base,
    ...p,
    currentCar: { ...base.currentCar, ...(p.currentCar ?? {}) },
    maintenance: { ...base.maintenance, ...(p.maintenance ?? {}) },
    cash: { ...base.cash, ...(p.cash ?? {}) },
    credit: { ...base.credit, ...(p.credit ?? {}) },
    bvc: { ...base.bvc, ...(p.bvc ?? {}) },
    omatome: { ...base.omatome, ...(p.omatome ?? {}) },
  }
}

/** JSON文字列としてエクスポート（整形済み）。 */
export function exportScenarioJson(scenario: Scenario): string {
  try {
    return JSON.stringify(scenario, null, 2)
  } catch {
    return ''
  }
}

/** JSON文字列をインポート。不正なら null。欠損キーは初期値で補完する。 */
export function importScenarioJson(json: string): Scenario | null {
  try {
    const parsed = JSON.parse(json)
    if (!parsed || typeof parsed !== 'object') return null
    // 欠損フィールド（ネスト含む）を初期値で補完して安全に取り込む。
    return mergeScenarioDefaults(parsed)
  } catch {
    return null
  }
}

/**
 * 共有URLを生成する。既定で個人情報を除去する。
 * includePersonalInfo=true のときのみ顧客名等を含める（明示操作）。
 */
export function buildShareUrl(
  scenario: Scenario,
  baseUrl: string,
  includePersonalInfo = false,
): string {
  const target = includePersonalInfo ? scenario : stripPersonalInfo(scenario)
  const payload = toBase64(JSON.stringify(target))
  if (!payload) return baseUrl
  const sep = baseUrl.includes('#') ? '' : '#'
  return `${baseUrl}${sep}s=${encodeURIComponent(payload)}`
}

/** URLハッシュから共有シナリオを復元する。失敗時は null。 */
export function parseShareFromHash(hash: string): Scenario | null {
  try {
    const m = /[#&]s=([^&]+)/.exec(hash)
    if (!m) return null
    const json = fromBase64(decodeURIComponent(m[1]))
    if (!json) return null
    return importScenarioJson(json)
  } catch {
    return null
  }
}
