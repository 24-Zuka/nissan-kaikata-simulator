/**
 * シナリオの状態管理フック。
 * - 入力state、localStorage永続化、共有URL復元、計算結果の導出を担う。
 * - 計算は calculateScenario に集約し、ここでは useMemo で導出するだけ（表示側で再計算しない）。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Scenario, ScenarioResult } from '../domain/types'
import { calculateScenario } from '../domain/scenario'
import { createDefaultScenario, createDefaultMaintenance } from '../domain/constants'
import { loadScenario, saveScenario } from '../utils/storage'
import { parseShareFromHash } from '../utils/share'

function initialScenario(): Scenario {
  // 共有URL > localStorage > 既定 の優先順で初期化する。
  if (typeof window !== 'undefined') {
    const shared = parseShareFromHash(window.location.hash)
    if (shared) return shared
  }
  const saved = loadScenario()
  if (saved) return saved
  return createDefaultScenario()
}

export type UseScenarioState = {
  scenario: Scenario
  result: ScenarioResult
  setScenario: (updater: (prev: Scenario) => Scenario) => void
  patch: (partial: Partial<Scenario>) => void
  /** carType変更時に維持費デフォルトを入れ替える（任意保険は未入力のまま）。 */
  changeCarType: (carType: Scenario['carType']) => void
  reset: () => void
  replace: (next: Scenario) => void
}

export function useScenarioState(): UseScenarioState {
  const [scenario, setScenarioState] = useState<Scenario>(initialScenario)

  // 計算結果は単一データ源（表示側で再計算しない）。
  const result = useMemo(() => calculateScenario(scenario), [scenario])

  // 変更を localStorage に保存（失敗してもクラッシュしない）。
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
    }
    saveScenario(scenario)
  }, [scenario])

  const setScenario = useCallback((updater: (prev: Scenario) => Scenario) => {
    setScenarioState((prev) => updater(prev))
  }, [])

  const patch = useCallback((partial: Partial<Scenario>) => {
    setScenarioState((prev) => ({ ...prev, ...partial }))
  }, [])

  const changeCarType = useCallback((carType: Scenario['carType']) => {
    setScenarioState((prev) => {
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
    })
  }, [])

  const reset = useCallback(() => {
    setScenarioState(createDefaultScenario())
  }, [])

  const replace = useCallback((next: Scenario) => {
    setScenarioState(next)
  }, [])

  return { scenario, result, setScenario, patch, changeCarType, reset, replace }
}
