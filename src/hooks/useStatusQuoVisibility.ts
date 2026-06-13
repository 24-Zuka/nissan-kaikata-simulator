/**
 * 現状維持の表示条件フック。
 * 判定本体は React 非依存の getStatusQuoVisibility に委譲し、ここは useMemo で包むだけ。
 * Context は使用しない。
 */

import { useMemo } from 'react'
import { getStatusQuoVisibility, type StatusQuoVisibility } from '../domain/visibility'
import type { CurrentCarInput } from '../domain/types'

export function useStatusQuoVisibility(currentCar: CurrentCarInput): StatusQuoVisibility {
  return useMemo(() => getStatusQuoVisibility(currentCar), [currentCar])
}
