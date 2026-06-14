/**
 * localStorage 永続化（安全版）。
 * 保存・読込の失敗でクラッシュさせない。読込失敗時は null を返し、呼び出し側が初期値へフォールバックする。
 */

import { STORAGE_KEYS } from '../domain/constants'
import type { Scenario, ScenarioWorkspace } from '../domain/types'
import { MAX_PATTERNS } from '../domain/types'
import { mergeScenarioDefaults } from './share'

function safeGet(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key: string, value: string): boolean {
  try {
    if (typeof localStorage === 'undefined') return false
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function saveScenario(scenario: Scenario): boolean {
  try {
    return safeSet(STORAGE_KEYS.scenario, JSON.stringify(scenario))
  } catch {
    return false
  }
}

export function loadScenario(): Scenario | null {
  const raw = safeGet(STORAGE_KEYS.scenario)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      // 欠損キー（ネスト含む）を既定値で補完し、旧バージョンの保存でも安全に復元する。
      return mergeScenarioDefaults(parsed)
    }
    return null
  } catch {
    return null
  }
}

export function saveWorkspace(ws: ScenarioWorkspace): boolean {
  try {
    return safeSet(STORAGE_KEYS.workspace, JSON.stringify(ws))
  } catch {
    return false
  }
}

/**
 * ワークスペース（A/B/C）を読み込む。
 * 各パターンは欠損補完し、1〜MAX_PATTERNS に正規化する。activeId が無効なら先頭にする。
 * 不正・空なら null（呼び出し側が旧形式移行 or 既定で初期化）。
 */
export function loadWorkspace(): ScenarioWorkspace | null {
  const raw = safeGet(STORAGE_KEYS.workspace)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.patterns)) return null
    const patterns = parsed.patterns
      .slice(0, MAX_PATTERNS)
      .map((p: unknown) => mergeScenarioDefaults(p))
    if (patterns.length === 0) return null
    const activeId =
      typeof parsed.activeId === 'string' && patterns.some((p: Scenario) => p.id === parsed.activeId)
        ? parsed.activeId
        : patterns[0].id
    return { patterns, activeId }
  } catch {
    return null
  }
}
