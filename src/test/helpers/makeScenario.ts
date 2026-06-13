import { createDefaultScenario } from '../../domain/constants'
import type { Scenario } from '../../domain/types'

/** テスト用にデフォルトシナリオを部分上書きして生成する。 */
export function makeScenario(overrides: Partial<Scenario> = {}): Scenario {
  return { ...createDefaultScenario(), ...overrides }
}
