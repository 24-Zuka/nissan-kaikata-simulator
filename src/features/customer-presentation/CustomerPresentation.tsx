import {
  EffectiveTotalChart,
  PlanMaintenanceMatrix,
  PlanCards,
  PrintComparisonTable,
  QuoteSummary,
  ScreenComparisonTable,
} from '../../components/ResultViews'
import type { ComparisonResult, Scenario } from '../../domain/types'

type Props = {
  scenario: Scenario
  result: ComparisonResult
}

export function CustomerPresentation({
  scenario,
  result,
}: Props) {
  const visiblePlanCount = result.plans.filter((plan) => plan.isVisible).length

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
          <ScreenComparisonTable plans={result.plans} scenario={scenario} />
        </div>
        <div className="mobile-comparison">
          <PlanCards plans={result.plans} scenario={scenario} />
        </div>
        <div className="print-comparison">
          <PrintComparisonTable plans={result.plans} />
        </div>
      </section>

      <EffectiveTotalChart plans={result.plans} />

      <section className={`presentation-section maintenance-section${visiblePlanCount === 5 ? ' is-five-plans' : ''}`}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">プラン別 維持費内訳</p>
            <h2>各プランの設定期間内に見込む費用</h2>
          </div>
        </div>
        <PlanMaintenanceMatrix plans={result.plans} scenario={scenario} />
      </section>
      <p className="print-disclaimer">
        ※本シミュレーションは概算です。<br />
        実際のお支払い金額・審査条件・登録費用・税金・保険料等により、最終的な金額は変動する場合がございます。
      </p>
    </main>
  )
}
