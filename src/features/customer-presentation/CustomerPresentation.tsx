import {
  EffectiveTotalChart,
  PlanMaintenanceMatrix,
  PlanCards,
  PrintComparisonTable,
  QuoteSummary,
  ScreenComparisonTable,
} from '../../components/ResultViews'
import type { ComparisonResult, Scenario } from '../../domain/types'
import { getPresentationReadiness } from '../detail-input/inputFlow'

type Props = {
  scenario: Scenario
  result: ComparisonResult
  onEdit: () => void
}

export function CustomerPresentation({
  scenario,
  result,
  onEdit,
}: Props) {
  const readiness = getPresentationReadiness(result)
  const completePlans = result.completePlans

  if (!readiness.canCompare) {
    return (
      <main className="presentation presentation--not-ready">
        <section className="presentation-readiness" aria-labelledby="presentation-readiness-title">
          <span className="presentation-readiness__status">比較準備</span>
          <p className="eyebrow">Customer Presentation</p>
          <h1 id="presentation-readiness-title">比較には完成したプランが2件必要です</h1>
          <p>
            現在、比較できるプランは{readiness.completePlanCount}件です。
            未完成プランの必須項目を入力するか、比較対象から外してください。
          </p>
          {readiness.incompletePlanLabels.length > 0 && (
            <div className="presentation-readiness__missing">
              <span>入力が必要</span>
              <ul>
                {readiness.incompletePlanLabels.map((label) => <li key={label}>{label}</li>)}
              </ul>
            </div>
          )}
          <button className="button button--primary" onClick={onEdit} type="button">
            入力画面で確認
          </button>
        </section>
      </main>
    )
  }

  const visiblePlanCount = completePlans.length

  return (
    <main className="presentation">
      <section className="presentation__intro print-header">
        <div>
          <p className="eyebrow presentation__vehicle-name">
            {scenario.quote.carName || '車種未入力'} {scenario.quote.grade}
          </p>
          <h1>購入方法の比較</h1>
          <p>
            月々の支払だけでなく、プランごとの維持期間で実質負担を比較します。
          </p>
        </div>
        <QuoteSummary scenario={scenario} result={result} />
      </section>

      <section className="presentation-section comparison-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{visiblePlanCount}プラン比較</p>
            <h2>支払と実質負担</h2>
          </div>
          <p>維持期間はプランごとに設定</p>
        </div>
        <div className="desktop-comparison">
          <ScreenComparisonTable plans={completePlans} scenario={scenario} />
        </div>
        <div className="mobile-comparison">
          <PlanCards plans={completePlans} scenario={scenario} />
        </div>
        <div className="print-comparison">
          <PrintComparisonTable plans={completePlans} />
        </div>
        {readiness.incompletePlanCount > 0 && (
          <p className="excluded-plans-note">
            未完成のため比較から除外: {readiness.incompletePlanLabels.join('、')}
          </p>
        )}
      </section>

      <EffectiveTotalChart plans={completePlans} />

      <section className={`presentation-section maintenance-section${visiblePlanCount === 5 ? ' is-five-plans' : ''}`}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">プラン別 維持費内訳</p>
            <h2>各プランの設定期間内に見込む費用</h2>
          </div>
        </div>
        <PlanMaintenanceMatrix plans={completePlans} scenario={scenario} />
      </section>
      <p className="print-disclaimer">
        ※本シミュレーションは概算です。<br />
        実際のお支払い金額・審査条件・登録費用・税金・保険料等により、最終的な金額は変動する場合がございます。
      </p>
    </main>
  )
}
