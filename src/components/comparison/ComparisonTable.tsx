/**
 * 5プラン比較表（お客様説明モードと印刷で共有）。
 * 計算済みの ScenarioResult を表示するだけ（再計算・再丸めしない）。
 *
 * 現状維持は showStatusQuo（表示条件）に従って列を出し分ける。
 * 現金一括の「月々の支払」は必ず金額（0円）で表示する。
 */

import type { PlanResult, ScenarioResult } from '../../domain/types'
import { formatYen } from '../../utils/format'

type Variant = 'screen' | 'print'

function visiblePlans(result: ScenarioResult, showStatusQuo: boolean): PlanResult[] {
  const plans: PlanResult[] = []
  if (showStatusQuo) plans.push(result.statusQuo)
  plans.push(result.cash, result.credit, result.bvc, result.omatome)
  return plans
}

/** 完了済みプランの中で最小値を持つ planId を返す（同値は複数）。 */
function lowestIds(plans: PlanResult[], pick: (p: PlanResult) => number): Set<string> {
  const candidates = plans.filter((p) => p.isComplete && pick(p) > 0)
  if (candidates.length === 0) return new Set()
  const min = Math.min(...candidates.map(pick))
  return new Set(candidates.filter((p) => pick(p) === min).map((p) => p.planId))
}

type RowProps = {
  label: string
  plans: PlanResult[]
  render: (p: PlanResult) => React.ReactNode
  strong?: boolean
  highlightIds?: Set<string>
  badge?: string
}

function Row({ label, plans, render, strong, highlightIds, badge }: RowProps) {
  return (
    <tr className={strong ? 'cmp__row cmp__row--strong' : 'cmp__row'}>
      <th scope="row" className="cmp__rowhead">
        {label}
      </th>
      {plans.map((p) => {
        const hit = highlightIds?.has(p.planId)
        return (
          <td key={p.planId} className={hit ? 'cmp__cell cmp__cell--best' : 'cmp__cell'}>
            <span className="cmp__value">{render(p)}</span>
            {hit && badge ? <span className="cmp__badge">{badge}</span> : null}
          </td>
        )
      })}
    </tr>
  )
}

export function ComparisonTable({
  result,
  showStatusQuo,
  variant = 'screen',
}: {
  result: ScenarioResult
  showStatusQuo: boolean
  variant?: Variant
}) {
  const plans = visiblePlans(result, showStatusQuo)
  const lowestMonthly = lowestIds(plans, (p) => p.effectiveMonthly)
  const lowestTotal = lowestIds(plans, (p) => p.effectiveTotal)

  return (
    <div className={`cmp cmp--${variant}`}>
      <table className="cmp__table">
        <thead>
          <tr>
            <th scope="col" className="cmp__corner">
              項目
            </th>
            {plans.map((p) => (
              <th key={p.planId} scope="col" className="cmp__planhead">
                {p.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <Row
            label="実質月額"
            plans={plans}
            strong
            highlightIds={lowestMonthly}
            badge="月額 最安"
            render={(p) => formatYen(p.effectiveMonthly)}
          />
          <Row
            label="実質総額"
            plans={plans}
            strong
            highlightIds={lowestTotal}
            badge="総額 最安"
            render={(p) => formatYen(p.effectiveTotal)}
          />
          <Row label="支払総額" plans={plans} render={(p) => formatYen(p.totalPayment)} />
          <Row label="頭金" plans={plans} render={(p) => formatYen(p.breakdown.downPayment)} />
          <Row
            label="月々の支払"
            plans={plans}
            render={(p) =>
              p.planId === 'cash' ? (
                <>一括（{formatYen(0)}/月）</>
              ) : (
                formatYen(p.monthlyPayment)
              )
            }
          />
          <Row
            label="初回支払額"
            plans={plans}
            render={(p) =>
              p.planId === 'cash' || p.initialPayment === 0 ? '—' : formatYen(p.initialPayment)
            }
          />
          <Row
            label="ボーナス月加算額"
            plans={plans}
            render={(p) =>
              p.bonusPayment > 0
                ? `${formatYen(p.bonusPayment)}（計${p.bonusPaymentCount}回）`
                : '—'
            }
          />
          <Row
            label="支払回数"
            plans={plans}
            render={(p) =>
              p.planId === 'cash' ? '一括' : p.paymentCount > 0 ? `${p.paymentCount}回` : '—'
            }
          />
          <Row
            label="最終回の支払"
            plans={plans}
            render={(p) =>
              p.planId === 'bvc'
                ? p.finalPayment > 0
                  ? `${formatYen(p.finalPayment)}（残価）`
                  : '—（返却）'
                : '—'
            }
          />
        </tbody>
      </table>
    </div>
  )
}
