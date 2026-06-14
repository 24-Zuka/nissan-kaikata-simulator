/**
 * お客様説明モード。
 * 詳細比較表をしっかり表示する画面。印刷の比較表と整合させる。
 * 現状維持は表示条件を満たす場合のみ表示。リース表記は使わない。
 */

import type { Scenario, ScenarioResult } from '../../domain/types'
import type { StatusQuoVisibility } from '../../domain/visibility'
import { ComparisonTable } from '../comparison/ComparisonTable'
import { MaintenanceBreakdown } from '../comparison/MaintenanceBreakdown'
import { BvcReturnPurchase } from '../comparison/BvcReturnPurchase'
import { PlanCards } from '../plans/PlanCards'
import { formatDateJp, formatYen } from '../../utils/format'

export function PresentationView({
  scenario,
  result,
  visibility,
}: {
  scenario: Scenario
  result: ScenarioResult
  visibility: StatusQuoVisibility
}) {
  // 維持費・BVC両建ては結果から参照（再計算しない＝比較表と同一の値）。
  const maintenance = result.maintenance

  const showStatusQuo = visibility.showInCustomerPresentation && result.statusQuo.isVisible
  const omatome = result.omatome

  // 現状維持との差額（説明用）。表示条件を満たす場合のみ。
  const diffBase = result.statusQuo.effectiveTotal

  return (
    <div className="presentation">
      <header className="presentation__head">
        <div>
          <h1 className="presentation__title">購入方法比較</h1>
          <p className="presentation__sub">
            {scenario.vehicleName || '車両'} {scenario.grade}
            {scenario.customerName ? ` / ${scenario.customerName}` : ''}
          </p>
        </div>
        <div className="presentation__meta">
          <span>比較期間: {result.comparisonMonths / 12}年</span>
          {scenario.quoteDate ? <span>作成日: {formatDateJp(scenario.quoteDate)}</span> : null}
        </div>
      </header>

      {/* PC: 比較表 / スマホ: カード（CSSで出し分け） */}
      <section className="presentation__block presentation__block--table">
        <h2 className="presentation__h2">5プラン比較</h2>
        <ComparisonTable result={result} showStatusQuo={showStatusQuo} variant="screen" />
      </section>

      <section className="presentation__block presentation__block--cards">
        <h2 className="presentation__h2">プラン別</h2>
        <PlanCards result={result} showStatusQuo={showStatusQuo} />
      </section>

      <div className="presentation__cols">
        <section className="presentation__block">
          <h2 className="presentation__h2">おまとめプランの概要</h2>
          <p className="presentation__text">
            おまとめプランは、車両費用と今後の維持費をまとめてお支払いいただくプランです。
          </p>
          <ul className="omatome__summary">
            <li>
              <span>実質月額</span>
              <strong>{formatYen(omatome.effectiveMonthly)}</strong>
            </li>
            <li>
              <span>実質総額</span>
              <strong>{formatYen(omatome.effectiveTotal)}</strong>
            </li>
            <li>
              <span>含まれる費用</span>
              <span>{omatome.includedItems.length ? omatome.includedItems.join('・') : 'なし'}</span>
            </li>
            <li>
              <span>別途必要な費用</span>
              <span>{omatome.excludedItems.length ? omatome.excludedItems.join('・') : 'なし'}</span>
            </li>
            <li>
              <span>任意保険</span>
              <span>{maintenance.insuranceEntered && scenario.omatome.includeInsurance ? '込み' : '別'}</span>
            </li>
          </ul>
        </section>

        <section className="presentation__block">
          <h2 className="presentation__h2">BVC 返却・買取</h2>
          <BvcReturnPurchase both={result.bvcBoth} />
        </section>
      </div>

      {showStatusQuo ? (
        <section className="presentation__block">
          <h2 className="presentation__h2">現状維持との差額（実質総額）</h2>
          <div className="diff__grid">
            {[result.cash, result.credit, result.bvc, result.omatome].map((p) => {
              const diff = p.effectiveTotal - diffBase
              const sign = diff > 0 ? '増' : diff < 0 ? '減' : '±0'
              return (
                <div key={p.planId} className="diff__cell">
                  <span className="diff__label">{p.label}</span>
                  <span className="diff__val">
                    {formatYen(Math.abs(diff))} {diff === 0 ? '' : sign}
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      <section className="presentation__block">
        <h2 className="presentation__h2">維持費用内訳</h2>
        <MaintenanceBreakdown maintenance={maintenance} variant="screen" />
      </section>
    </div>
  )
}
