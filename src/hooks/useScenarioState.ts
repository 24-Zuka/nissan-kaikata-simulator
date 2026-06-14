/**
 * シナリオの状態管理フック（A/B/C 最大3パターン対応）。
 * - ワークスペース（patterns + activeId）を保持し、編集中(active)のパターンを公開する。
 * - 計算は active パターンに対する calculateScenario に集約（表示側で再計算しない）。
 * - 共有URL > ワークスペース保存 > 旧単一保存 > 既定 の優先順で初期化する。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Scenario, ScenarioResult, ScenarioWorkspace } from '../domain/types'
import { MAX_PATTERNS } from '../domain/types'
import { calculateScenario } from '../domain/scenario'
import { createDefaultScenario, createDefaultMaintenance, generateId } from '../domain/constants'
import { loadScenario, loadWorkspace, saveWorkspace } from '../utils/storage'
import { parseShareFromHash } from '../utils/share'

function initialWorkspace(): ScenarioWorkspace {
  // 共有URLが最優先（単一パターンとして開く）。
  if (typeof window !== 'undefined') {
    const shared = parseShareFromHash(window.location.hash)
    if (shared) return { patterns: [shared], activeId: shared.id }
  }
  const ws = loadWorkspace()
  if (ws) return ws
  // 旧単一保存があれば1パターンへ移行する。
  const legacy = loadScenario()
  if (legacy) return { patterns: [legacy], activeId: legacy.id }
  const def = createDefaultScenario()
  return { patterns: [def], activeId: def.id }
}

export type PatternInfo = { id: string; name: string }

export type UseScenarioState = {
  scenario: Scenario
  result: ScenarioResult
  setScenario: (updater: (prev: Scenario) => Scenario) => void
  patch: (partial: Partial<Scenario>) => void
  /** carType変更時に維持費デフォルトを入れ替える（任意保険は未入力のまま）。 */
  changeCarType: (carType: Scenario['carType']) => void
  reset: () => void
  replace: (next: Scenario) => void

  // --- A/B/C パターン管理 ---
  patterns: PatternInfo[]
  activeId: string
  /** 上限未満なら true（追加・複製が可能）。 */
  canAddPattern: boolean
  /** 2つ以上あれば true（削除が可能）。 */
  canDeletePattern: boolean
  switchPattern: (id: string) => void
  addPattern: () => void
  duplicatePattern: () => void
  deletePattern: (id: string) => void
}

export function useScenarioState(): UseScenarioState {
  const [ws, setWs] = useState<ScenarioWorkspace>(initialWorkspace)

  const active = useMemo(
    () => ws.patterns.find((p) => p.id === ws.activeId) ?? ws.patterns[0],
    [ws],
  )

  // 計算結果は単一データ源（表示側で再計算しない）。
  const result = useMemo(() => calculateScenario(active), [active])

  // 変更を localStorage に保存（失敗してもクラッシュしない）。
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
    }
    saveWorkspace(ws)
  }, [ws])

  /** active パターンだけを更新するヘルパー。 */
  const updateActive = useCallback((updater: (prev: Scenario) => Scenario) => {
    setWs((prev) => ({
      ...prev,
      patterns: prev.patterns.map((p) => (p.id === prev.activeId ? updater(p) : p)),
    }))
  }, [])

  const setScenario = useCallback(
    (updater: (prev: Scenario) => Scenario) => updateActive(updater),
    [updateActive],
  )

  const patch = useCallback(
    (partial: Partial<Scenario>) => updateActive((prev) => ({ ...prev, ...partial })),
    [updateActive],
  )

  const changeCarType = useCallback(
    (carType: Scenario['carType']) =>
      updateActive((prev) => {
        const nextMaintenance = createDefaultMaintenance(carType)
        // ユーザーが触っている可能性のある「任意保険」設定は維持する。
        return {
          ...prev,
          carType,
          maintenance: {
            ...nextMaintenance,
            simulationYears: prev.maintenance.simulationYears,
            tireReplacementCycleYears: prev.maintenance.tireReplacementCycleYears,
            insuranceMonthly: prev.maintenance.insuranceMonthly,
            includeInsurance: prev.maintenance.includeInsurance,
          },
        }
      }),
    [updateActive],
  )

  /** active パターンの内容を初期化する（IDは維持し、他パターンは残す）。 */
  const reset = useCallback(() => {
    updateActive((prev) => ({ ...createDefaultScenario(), id: prev.id }))
  }, [updateActive])

  /** active パターンを取り込んだシナリオで置き換える（IDは維持）。 */
  const replace = useCallback(
    (next: Scenario) => {
      updateActive((prev) => ({ ...next, id: prev.id }))
    },
    [updateActive],
  )

  const switchPattern = useCallback((id: string) => {
    setWs((prev) =>
      prev.patterns.some((p) => p.id === id) ? { ...prev, activeId: id } : prev,
    )
  }, [])

  const addPattern = useCallback(() => {
    setWs((prev) => {
      if (prev.patterns.length >= MAX_PATTERNS) return prev
      const next = createDefaultScenario()
      return { patterns: [...prev.patterns, next], activeId: next.id }
    })
  }, [])

  const duplicatePattern = useCallback(() => {
    setWs((prev) => {
      if (prev.patterns.length >= MAX_PATTERNS) return prev
      const src = prev.patterns.find((p) => p.id === prev.activeId) ?? prev.patterns[0]
      const copy: Scenario = { ...src, id: generateId(), name: `${src.name} のコピー` }
      return { patterns: [...prev.patterns, copy], activeId: copy.id }
    })
  }, [])

  const deletePattern = useCallback((id: string) => {
    setWs((prev) => {
      if (prev.patterns.length <= 1) return prev
      const patterns = prev.patterns.filter((p) => p.id !== id)
      const activeId = prev.activeId === id ? patterns[0].id : prev.activeId
      return { patterns, activeId }
    })
  }, [])

  return {
    scenario: active,
    result,
    setScenario,
    patch,
    changeCarType,
    reset,
    replace,
    patterns: ws.patterns.map((p) => ({ id: p.id, name: p.name })),
    activeId: ws.activeId,
    canAddPattern: ws.patterns.length < MAX_PATTERNS,
    canDeletePattern: ws.patterns.length > 1,
    switchPattern,
    addPattern,
    duplicatePattern,
    deletePattern,
  }
}
