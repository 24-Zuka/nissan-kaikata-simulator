/**
 * 金額表示プリミティブ（右揃え・tabular-nums）。
 * 計算済みの整数を表示するだけ（再計算・再丸めしない）。
 */

import { formatYen } from '../../utils/format'

export function Amount({
  value,
  strong,
  muted,
}: {
  value: number
  strong?: boolean
  muted?: boolean
}) {
  const cls = ['amount', strong ? 'amount--strong' : '', muted ? 'amount--muted' : '']
    .filter(Boolean)
    .join(' ')
  return <span className={cls}>{formatYen(value)}</span>
}
