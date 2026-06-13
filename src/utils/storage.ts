/**
 * localStorage 永続化（安全版）。
 * 保存・読込の失敗でクラッシュさせない。読込失敗時は null を返し、呼び出し側が初期値へフォールバックする。
 */

import { STORAGE_KEYS } from '../domain/constants'
import type { Scenario } from '../domain/types'

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
    if (parsed && typeof parsed === 'object' && 'id' in parsed) {
      return parsed as Scenario
    }
    return null
  } catch {
    return null
  }
}
