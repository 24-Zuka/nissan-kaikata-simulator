/**
 * スマホ向けプラン別カード。
 * 重要金額（実質月額・実質総額）をカード上部に表示し、詳細は折りたたみ。
 */

import { useState } from 'react'
import type { PlanResult, ScenarioResult } from '../../domain/types'
import { formatYen } from '../../utils/format'

function PlanCard({ plan }: { plan: PlanResult }) {
  const [open, setOpen] = useState(false)
  return (
    <article className="pcard">
      <header className="pcard__head">
        <h3 className="pcard__title">{plan.label}</h3>
      </header>
      <div className="pcard__keyfigs">
        <div className="pcard__keyfig">
          <span className="pcard__kflabel">実質月額</span>
          <span className="pcard__kfvalue">{formatYen(plan.effectiveMonthly)}</span>
        </div>
        <div className="pcard__keyfig">
          <span className="pcard__kflabel">実質総額</span>
          <span className="pcard__kfvalue">{formatYen(plan.effectiveTotal)}</span>
        </div>
      </div>
      <button
        type="button"
        className="pcard__toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? '詳細を閉じる' : '詳細を見る'}
      </button>
      {open ? (
        <dl className="pcard__detail">
          <div>
            <dt>支払総額</dt>
            <dd>{formatYen(plan.totalPayment)}</dd>
          </div>
          <div>
            <dt>頭金</dt>
            <dd>{formatYen(plan.breakdown.downPayment)}</dd>
          </div>
          <div>
            <dt>月々の支払</dt>
            <dd>{plan.planId === 'cash' ? `一括（${formatYen(0)}/月）` : formatYen(plan.monthlyPayment)}</dd>
          </div>
          {plan.initialPayment > 0 && plan.planId !== 'cash' ? (
            <div>
              <dt>初回支払額</dt>
              <dd>{formatYen(plan.initialPayment)}</dd>
            </div>
          ) : null}
          {plan.bonusPayment > 0 ? (
            <div>
              <dt>ボーナス加算</dt>
              <dd>
                {formatYen(plan.bonusPayment)}（計{plan.bonusPaymentCount}回）
              </dd>
            </div>
          ) : null}
          {plan.paymentCount > 0 ? (
            <div>
              <dt>支払回数</dt>
              <dd>{plan.paymentCount}回</dd>
            </div>
          ) : null}
          {plan.planId === 'bvc' && plan.residualValue > 0 ? (
            <div>
              <dt>最終回（残価）</dt>
              <dd>{plan.finalPayment > 0 ? formatYen(plan.finalPayment) : '—（返却）'}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </article>
  )
}

export function PlanCards({
  result,
  showStatusQuo,
}: {
  result: ScenarioResult
  showStatusQuo: boolean
}) {
  const plans: PlanResult[] = []
  if (showStatusQuo) plans.push(result.statusQuo)
  plans.push(result.cash, result.credit, result.bvc, result.omatome)
  return (
    <div className="pcards">
      {plans.map((p) => (
        <PlanCard key={p.planId} plan={p} />
      ))}
    </div>
  )
}
