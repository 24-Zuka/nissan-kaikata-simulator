/**
 * 維持費用内訳（お客様説明モード・印刷で共有）。
 * 1回あたり/月額・発生周期・回数・合計を表示する。
 * タイヤは必ず「夏・冬タイヤ」。任意保険は未入力なら「未入力」と表示し、初期値を勝手に出さない。
 */

import type { MaintenanceResult } from '../../domain/maintenance'
import { formatYen } from '../../utils/format'

export function MaintenanceBreakdown({
  maintenance,
  variant = 'screen',
}: {
  maintenance: MaintenanceResult
  variant?: 'screen' | 'print'
}) {
  return (
    <div className={`mtn mtn--${variant}`}>
      <table className="mtn__table">
        <thead>
          <tr>
            <th scope="col" className="mtn__th mtn__th--item">
              項目
            </th>
            <th scope="col" className="mtn__th mtn__th--num">
              1回あたり / 月額
            </th>
            <th scope="col" className="mtn__th">
              発生周期
            </th>
            <th scope="col" className="mtn__th mtn__th--num">
              回数
            </th>
            <th scope="col" className="mtn__th mtn__th--num">
              合計
            </th>
          </tr>
        </thead>
        <tbody>
          {maintenance.items.map((it) => {
            const isInsurance = it.key === 'insurance'
            const notEntered = isInsurance && !it.entered
            return (
              <tr key={it.key} className="mtn__row">
                <th scope="row" className="mtn__item">
                  {it.label}
                </th>
                <td className="mtn__num">
                  {notEntered ? <span className="mtn__blank">未入力</span> : formatYen(it.unitCost)}
                </td>
                <td className="mtn__cycle">
                  {isInsurance ? (it.entered ? '月額・含む' : '含まない') : it.cycleLabel}
                </td>
                <td className="mtn__num">
                  {notEntered ? '—' : isInsurance ? `${it.count}か月` : `${it.count}回`}
                </td>
                <td className="mtn__num">
                  {notEntered ? '—' : formatYen(it.total)}
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="mtn__total">
            <th scope="row" colSpan={4} className="mtn__totallabel">
              維持費合計
            </th>
            <td className="mtn__num mtn__num--strong">{formatYen(maintenance.total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
