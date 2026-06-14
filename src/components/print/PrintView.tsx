/**
 * 印刷ビュー（A4横1枚）。
 * 上段: 比較表（お客様説明モードの比較表をベース） / 下段: 維持費用内訳。
 * 太い黒枠なし・QRコードなし・作成日1箇所・「夏・冬タイヤ」表記。
 */

import type { Scenario, ScenarioResult } from '../../domain/types'
import type { StatusQuoVisibility } from '../../domain/visibility'
import { ComparisonTable } from '../comparison/ComparisonTable'
import { MaintenanceBreakdown } from '../comparison/MaintenanceBreakdown'
import { formatDateJp } from '../../utils/format'

export function PrintView({
  scenario,
  result,
  visibility,
}: {
  scenario: Scenario
  result: ScenarioResult
  visibility: StatusQuoVisibility
}) {
  // 維持費は結果から参照（再計算しない＝お客様説明モード/比較表と同一の値）。
  const maintenance = result.maintenance
  const showStatusQuo = visibility.showInPrintComparison && result.statusQuo.isVisible

  return (
    <div className="printsheet" id="print-root">
      {/* ヘッダー（作成日は1箇所のみ） */}
      <header className="printsheet__head">
        <div className="printsheet__titlewrap">
          <h1 className="printsheet__title">購入方法比較</h1>
          <p className="printsheet__sub">
            {scenario.vehicleName || '車両'} {scenario.grade}
            {scenario.customerName ? ` ${scenario.customerName}` : ''}
          </p>
        </div>
        <div className="printsheet__meta">
          <span>比較期間 {result.comparisonMonths / 12}年</span>
          {scenario.staffName ? <span>担当 {scenario.staffName}</span> : null}
          {scenario.quoteDate ? <span>作成日 {formatDateJp(scenario.quoteDate)}</span> : null}
        </div>
      </header>

      {/* 上段: 比較表 */}
      <section className="printsheet__block printsheet__block--top">
        <h2 className="printsheet__h2">5プラン比較</h2>
        <ComparisonTable result={result} showStatusQuo={showStatusQuo} variant="print" />
      </section>

      {/* 下段: 維持費用内訳（大きく配置） */}
      <section className="printsheet__block printsheet__block--bottom">
        <h2 className="printsheet__h2">維持費用内訳</h2>
        <MaintenanceBreakdown maintenance={maintenance} variant="print" />
      </section>
    </div>
  )
}
