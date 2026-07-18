import { formatYen } from '../domain/money'
import type { CSSProperties, ReactNode } from 'react'
import type {
  ComparisonResult,
  MaintenanceInput,
  PlanResult,
  Scenario,
} from '../domain/types'
import {
  COMPARISON_ROWS,
  formatPaymentCount,
  getPlanRowLabel,
  getResultValue,
  type ComparisonRowKey,
} from './resultRows'
import { InputProgress } from './InputProgress'
import type { InputStageId } from '../features/detail-input/inputFlow'

function formatResultValue(plan: PlanResult, key: ComparisonRowKey) {
  if (!plan.isComplete) return '要入力'
  if (key === 'paymentCount') return formatPaymentCount(plan)
  return formatYen(getResultValue(plan, key))
}

function printResultValue(plan: PlanResult, key: ComparisonRowKey) {
  if (!plan.isComplete) return '要入力'
  if (key === 'paymentCount') return formatPaymentCount(plan)
  if (key === 'effectiveTotal') return displayMoney(plan, plan.effectiveTotal)
  return formatYen(getResultValue(plan, key))
}

function getPriceBasisLabel(plan: PlanResult): string {
  if (plan.priceBasis === 'current') return '現在の車を継続'
  return plan.priceBasis === 'used' ? '中古車価格で試算' : '新車価格で試算'
}

function getModeLabel(plan: PlanResult): string | null {
  if (!plan.selectedMode) return null
  return plan.selectedMode === 'purchase' ? '買取時' : '返却時'
}

function getPlanContextLabel(plan: PlanResult): string {
  const mode = getModeLabel(plan)
  return [getPriceBasisLabel(plan), mode].filter(Boolean).join('・')
}

function displayMoney(plan: PlanResult, value: number): string {
  if (!plan.isComplete) return '要入力'
  return formatYen(value)
}

function customerMaintenanceTotal(plan: PlanResult): number {
  return plan.maintenanceCoverage.customerCost
}

function purchaseMaintenanceForPlan(
  plan: PlanResult,
  scenario: Scenario,
): MaintenanceInput | null {
  if (plan.planId === 'statusQuo') return null
  return plan.priceBasis === 'used' ? scenario.usedMaintenance : scenario.newMaintenance
}

function getEndOfTermLabel(plan: PlanResult): string {
  if (!plan.selectedMode) return plan.planId === 'cash' ? '一括購入' : '所有継続'
  return plan.selectedMode === 'purchase' ? '買取' : '返却'
}

function getInsuranceLabel(plan: PlanResult, scenario: Scenario): string {
  if (plan.planId === 'statusQuo') {
    return scenario.currentCar.monthlyInsurance === '' ? '未入力' : '維持費に反映'
  }
  const maintenance = purchaseMaintenanceForPlan(plan, scenario)
  if (!maintenance?.includeInsurance) return '対象外'
  if (plan.planId === 'omatome') {
    return scenario.omatome.included.insurance ? 'リース期間内込み' : '別途負担'
  }
  return '維持費に反映'
}

function getChartTag(plan: PlanResult): string {
  if (plan.planId === 'statusQuo') return '現在'
  if (plan.planId === 'cash') return '一括'
  if (plan.planId === 'credit') return '分割'
  if (plan.planId === 'bvc') return '残価'
  return 'リース'
}

export function CompletionBadge({ plan }: { plan: PlanResult }) {
  return (
    <span className={`status-badge ${plan.isComplete ? 'is-complete' : 'is-incomplete'}`}>
      {plan.isComplete ? '入力済み' : '要入力'}
    </span>
  )
}

export function QuickResults({
  result,
  activeStage = 'dealVehicle',
  onStageChange = () => undefined,
  showProgress = true,
}: {
  result: ComparisonResult
  activeStage?: InputStageId
  onStageChange?: (stageId: InputStageId) => void
  showProgress?: boolean
}) {
  const plans = result.plans.filter((plan) => plan.isVisible)

  return (
    <aside className="quick-results" aria-label="比較結果の簡易確認">
      {showProgress && (
        <InputProgress
          result={result}
          activeStage={activeStage}
          onStageChange={onStageChange}
        />
      )}
      <div className="quick-results__heading">
        <p className="eyebrow">簡易確認</p>
        <h2>比較結果</h2>
        <p>詳細はお客様説明モードで確認できます。</p>
      </div>
      <div className="quick-results__list">
        {plans.map((plan) => (
          <article className="quick-plan" key={plan.planId}>
            <div className="quick-plan__summary">
              <div>
                <div className="quick-plan__title">
                  <h3>{plan.label}</h3>
                  <CompletionBadge plan={plan} />
                </div>
                <p className="price-basis-label">
                  {plan.maintenanceYears}年・{getPlanContextLabel(plan)}
                </p>
              </div>
              <div className="quick-plan__amount">
                <strong>{displayMoney(plan, plan.effectiveMonthly)}</strong>
                <span>/月</span>
              </div>
            </div>
            <p className="quick-plan__meta">
              実質総額 {displayMoney(plan, plan.effectiveTotal)}
              <span>
                顧客負担維持費{' '}
                {plan.isComplete ? formatYen(customerMaintenanceTotal(plan)) : '要入力'}
              </span>
            </p>
            {plan.warnings[0] && <p className="inline-warning">{plan.warnings[0]}</p>}
          </article>
        ))}
      </div>
    </aside>
  )
}

export function ScreenComparisonTable({
  plans,
  scenario,
}: {
  plans: PlanResult[]
  scenario: Scenario
}) {
  const visiblePlans = plans.filter((plan) => plan.isVisible)

  return (
    <div className="screen-comparison-wrap">
      <table className="screen-comparison-table">
        <thead>
          <tr>
            <th scope="col">プラン</th>
            <th scope="col">実質月額</th>
            <th scope="col">実質総額</th>
            <th scope="col">顧客負担維持費</th>
            <th scope="col">維持期間</th>
            <th scope="col">満了時</th>
            <th scope="col">任意保険</th>
          </tr>
        </thead>
        <tbody>
          {visiblePlans.map((plan) => (
            <tr key={plan.planId}>
              <th scope="row">
                <span>{plan.label}</span>
                <small>{getPriceBasisLabel(plan)}</small>
                <CompletionBadge plan={plan} />
              </th>
              <td className="is-primary-number">
                {displayMoney(plan, plan.effectiveMonthly)}
              </td>
              <td>{displayMoney(plan, plan.effectiveTotal)}</td>
              <td>{plan.isComplete ? formatYen(customerMaintenanceTotal(plan)) : '要入力'}</td>
              <td>{plan.maintenanceYears}年</td>
              <td>{getEndOfTermLabel(plan)}</td>
              <td>{getInsuranceLabel(plan, scenario)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

type PrintComparisonRow = {
  key: ComparisonRowKey | 'endOfTerm' | 'customerMaintenance'
  label: string
  emphasis?: 'monthly' | 'total'
}

const PRINT_COMPARISON_ROWS: PrintComparisonRow[] = [
  { key: 'paymentCount', label: '支払い回数' },
  { key: 'purchasePayment', label: '購入時支払' },
  { key: 'monthlyBurden', label: '月あたりの支払' },
  { key: 'bonusPayment', label: 'ボーナス支払' },
  { key: 'totalPayment', label: '車両購入金額' },
  { key: 'finalPayment', label: '最終回/残債' },
  { key: 'endOfTerm', label: '満了時の扱い' },
  { key: 'customerMaintenance', label: '顧客負担維持費' },
  { key: 'effectiveMonthly', label: '実質月額', emphasis: 'monthly' },
  { key: 'effectiveTotal', label: '実質支払額', emphasis: 'total' },
]

function printComparisonValue(plan: PlanResult, row: PrintComparisonRow) {
  if (row.key === 'endOfTerm') return getEndOfTermLabel(plan)
  if (row.key === 'customerMaintenance') return formatYen(customerMaintenanceTotal(plan))
  return printResultValue(plan, row.key)
}

export function ComparisonTable({
  plans,
  scenario,
}: {
  plans: PlanResult[]
  scenario: Scenario
}) {
  const visiblePlans = plans.filter((plan) => plan.isVisible)

  return (
    <div className="comparison-table-wrap">
      <table className="comparison-table">
        <thead>
          <tr>
            <th scope="col">比較項目</th>
            {visiblePlans.map((plan) => (
              <th scope="col" key={plan.planId}>
                <span>{plan.label}</span>
                <small>{plan.maintenanceYears}年維持</small>
                <small className="price-basis-label">{getPlanContextLabel(plan)}</small>
                <CompletionBadge plan={plan} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARISON_ROWS.map((row) => (
            <tr className={row.emphasis ? 'is-emphasis' : ''} key={row.key}>
              <th scope="row">{row.label}</th>
              {visiblePlans.map((plan) => (
                <td key={`${plan.planId}-${row.key}`}>
                  {(row.key === 'purchasePayment' || row.key === 'monthlyBurden') && (
                    <small className="comparison-cell-label">
                      {getPlanRowLabel(plan, row.key, row.label)}
                    </small>
                  )}
                  {formatResultValue(plan, row.key)}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <th scope="row">顧客負担維持費</th>
            {visiblePlans.map((plan) => (
              <td key={`${plan.planId}-maintenance`}>
                {plan.isComplete ? formatYen(customerMaintenanceTotal(plan)) : '要入力'}
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row">維持期間</th>
            {visiblePlans.map((plan) => (
              <td key={`${plan.planId}-years`}>{plan.maintenanceYears}年</td>
            ))}
          </tr>
          <tr>
            <th scope="row">満了時の扱い</th>
            {visiblePlans.map((plan) => (
              <td key={`${plan.planId}-mode`}>{getEndOfTermLabel(plan)}</td>
            ))}
          </tr>
          <tr>
            <th scope="row">任意保険</th>
            {visiblePlans.map((plan) => (
              <td key={`${plan.planId}-insurance`}>{getInsuranceLabel(plan, scenario)}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export function PrintComparisonTable({ plans }: { plans: PlanResult[] }) {
  const visiblePlans = plans.filter((plan) => plan.isVisible && plan.isComplete)

  return (
    <div className="comparison-table-wrap">
      <table className="comparison-table print-payment-table">
        <thead>
          <tr>
            <th scope="col">比較項目</th>
            {visiblePlans.map((plan) => (
              <th scope="col" key={plan.planId}>
                <span>{plan.label}</span>
                <small>{plan.maintenanceYears}年維持</small>
                <small className="price-basis-label">{getPlanContextLabel(plan)}</small>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PRINT_COMPARISON_ROWS.map((row) => (
            <tr
              className={row.emphasis ? `is-emphasis print-emphasis-${row.emphasis}` : ''}
              key={row.key}
            >
              <th scope="row">{row.label}</th>
              {visiblePlans.map((plan) => (
                <td key={`${plan.planId}-${row.key}`}>
                  {(row.key === 'purchasePayment' || row.key === 'monthlyBurden') && (
                    <small className="comparison-cell-label">
                      {getPlanRowLabel(plan, row.key, row.label)}
                    </small>
                  )}
                  {printComparisonValue(plan, row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function PlanCards({ plans, scenario }: { plans: PlanResult[]; scenario: Scenario }) {
  return (
    <div className="plan-cards">
      {plans
        .filter((plan) => plan.isVisible)
        .map((plan) => (
          <article className="plan-card" key={plan.planId}>
            <header>
              <div>
                <h3>{plan.label}</h3>
                <span>{plan.maintenanceYears}年維持</span>
              </div>
              <CompletionBadge plan={plan} />
            </header>
            <p className="price-basis-label">{getPlanContextLabel(plan)}</p>
            <div className="plan-card__primary">
              <span>実質月額</span>
              <strong>{displayMoney(plan, plan.effectiveMonthly)}</strong>
            </div>
            <dl className="plan-card__totals">
              <div>
                <dt>実質総額</dt>
                <dd>{displayMoney(plan, plan.effectiveTotal)}</dd>
              </div>
              <div>
                <dt>支払総額</dt>
                <dd>{displayMoney(plan, plan.totalPayment)}</dd>
              </div>
              <div>
                <dt>顧客負担維持費</dt>
                <dd>{plan.isComplete ? formatYen(customerMaintenanceTotal(plan)) : '要入力'}</dd>
              </div>
            </dl>
            <dl className="plan-card__conditions">
              <div><dt>満了時</dt><dd>{getEndOfTermLabel(plan)}</dd></div>
              <div><dt>任意保険</dt><dd>{getInsuranceLabel(plan, scenario)}</dd></div>
            </dl>
            <details>
              <summary>支払条件と内訳</summary>
              <dl className="plan-card__details">
                {COMPARISON_ROWS.slice(3).map((row) => (
                  <div key={row.key}>
                    <dt>{getPlanRowLabel(plan, row.key, row.label)}</dt>
                    <dd>{formatResultValue(plan, row.key)}</dd>
                  </div>
                ))}
              </dl>
              {plan.warnings.length > 0 && (
                <ul className="warning-list">
                  {plan.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              )}
            </details>
          </article>
        ))}
    </div>
  )
}

export function PrintPlanCards({ plans }: { plans: PlanResult[] }) {
  return (
    <div className="print-plan-cards">
      {plans
        .filter((plan) => plan.isVisible && plan.isComplete)
        .map((plan) => {
          const monthlyLabel = plan.planId === 'cash' ? '月々換算' : '月々支払'
          const monthlyValue = plan.planId === 'cash'
            ? plan.monthlyEquivalent
            : plan.monthlyPayment
          return (
            <article className="print-plan-card" key={plan.planId}>
              <header>
                <h3>{plan.label}</h3>
                <span>{getPlanContextLabel(plan)}</span>
              </header>
              <div className="print-plan-card__primary">
                <span>実質月額</span>
                <strong>{displayMoney(plan, plan.effectiveMonthly)}</strong>
              </div>
              <dl>
                <div>
                  <dt>支払総額</dt>
                  <dd>{displayMoney(plan, plan.totalPayment)}</dd>
                </div>
                <div>
                  <dt>{monthlyLabel}</dt>
                  <dd>{displayMoney(plan, monthlyValue)}</dd>
                </div>
                <div>
                  <dt>実質総額</dt>
                  <dd>{displayMoney(plan, plan.effectiveTotal)}</dd>
                </div>
                <div>
                  <dt>維持期間</dt>
                  <dd>{plan.maintenanceYears}年</dd>
                </div>
              </dl>
              {!plan.hasRequiredPrice && (
                <p className="print-plan-card__warning">価格を入力してください</p>
              )}
            </article>
          )
        })}
    </div>
  )
}

type MaintenanceDisplayKey =
  | 'inspectionCost'
  | 'checks'
  | 'tireCost'
  | 'taxCost'
  | 'insuranceCost'
  | 'repairCost'
  | 'total'

const maintenanceRows: { key: MaintenanceDisplayKey; label: string }[] = [
  { key: 'inspectionCost', label: '車検' },
  { key: 'checks', label: '点検' },
  { key: 'tireCost', label: '夏・冬タイヤ' },
  { key: 'taxCost', label: '自動車税' },
  { key: 'insuranceCost', label: '任意保険' },
  { key: 'repairCost', label: '修理費用' },
  { key: 'total', label: '維持費合計' },
]

function maintenanceValue(
  plan: PlanResult,
  key: MaintenanceDisplayKey,
  scenario: Scenario,
): string {
  if (key === 'insuranceCost') {
    const purchaseMaintenance = purchaseMaintenanceForPlan(plan, scenario)
    const insuranceBlank =
      plan.planId === 'statusQuo'
        ? scenario.currentCar.monthlyInsurance === ''
        : purchaseMaintenance?.monthlyInsurance === ''
    if (plan.planId !== 'statusQuo' && !purchaseMaintenance?.includeInsurance) {
      return '対象外'
    }
    if (insuranceBlank) return '未入力'
  }

  if (key === 'checks') {
    if (plan.planId === 'omatome') {
      return formatYen(
        customerMaintenanceCost(plan, 'legalInspection')
          + customerMaintenanceCost(plan, 'sixMonthInspection'),
      )
    }
    return formatYen(plan.maintenance.legalInspectionCost + plan.maintenance.sixMonthInspectionCost)
  }
  if (key === 'repairCost' && plan.maintenance.repairCost === 0) return '—'
  if (plan.planId === 'omatome') {
    if (key === 'total') return formatYen(plan.maintenanceCoverage.customerCost)
    const itemIdByKey: Partial<Record<MaintenanceDisplayKey, MaintenanceItemId>> = {
      inspectionCost: 'inspection',
      tireCost: 'tires',
      taxCost: 'tax',
      insuranceCost: 'insurance',
      repairCost: 'repair',
    }
    const itemId = itemIdByKey[key]
    if (itemId) return formatYen(customerMaintenanceCost(plan, itemId))
  }
  return formatYen(plan.maintenance[key])
}

type PrintCell = string | ReactNode
type PrintMaintenanceRow = {
  id: string
  label: string
  unitCost: PrintCell
  total: PrintCell
  totalRow?: boolean
}

type MaintenanceItemId = PlanResult['maintenance']['breakdown'][number]['id']

function maintenanceItem(plan: PlanResult, id: MaintenanceItemId) {
  return plan.maintenance.breakdown.find((entry) => entry.id === id)!
}

function customerMaintenanceCost(plan: PlanResult, id: MaintenanceItemId): number {
  return plan.maintenanceCoverage.items.find((entry) => entry.id === id)?.customerCost ?? 0
}

function inlineCheckCosts(legalCost: number, sixMonthCost: number): ReactNode {
  return (
    <span className="print-check-costs">
      <span><small>12か月</small>{formatYen(legalCost)}</span>
      <span><small>6か月</small>{formatYen(sixMonthCost)}</span>
    </span>
  )
}

function printMaintenanceRows(plan: PlanResult, scenario: Scenario): PrintMaintenanceRow[] {
  const inspection = maintenanceItem(plan, 'inspection')
  const legal = maintenanceItem(plan, 'legalInspection')
  const sixMonth = maintenanceItem(plan, 'sixMonthInspection')
  const tires = maintenanceItem(plan, 'tires')
  const tax = maintenanceItem(plan, 'tax')
  const insurance = maintenanceItem(plan, 'insurance')
  const repair = maintenanceItem(plan, 'repair')
  const inspectionCustomer = customerMaintenanceCost(plan, 'inspection')
  const legalCustomer = customerMaintenanceCost(plan, 'legalInspection')
  const sixMonthCustomer = customerMaintenanceCost(plan, 'sixMonthInspection')
  const tiresCustomer = customerMaintenanceCost(plan, 'tires')
  const taxCustomer = customerMaintenanceCost(plan, 'tax')
  const insuranceCustomer = customerMaintenanceCost(plan, 'insurance')
  const purchaseMaintenance = purchaseMaintenanceForPlan(plan, scenario)
  const insuranceBlank = plan.planId === 'statusQuo'
    ? scenario.currentCar.monthlyInsurance === ''
    : purchaseMaintenance?.monthlyInsurance === ''
  const insuranceExcluded = plan.planId !== 'statusQuo'
    && !purchaseMaintenance?.includeInsurance
  const insuranceState = insuranceExcluded ? '対象外' : insuranceBlank ? '未入力' : null

  const rows: PrintMaintenanceRow[] = [
    {
      id: 'inspection',
      label: '車検',
      unitCost: formatYen(inspectionCustomer > 0 ? inspection.unitCost : 0),
      total: formatYen(inspectionCustomer),
    },
    {
      id: 'checks',
      label: '点検',
      unitCost: inlineCheckCosts(
        legalCustomer > 0 ? legal.unitCost : 0,
        sixMonthCustomer > 0 ? sixMonth.unitCost : 0,
      ),
      total: formatYen(legalCustomer + sixMonthCustomer),
    },
    {
      id: 'tires',
      label: '夏・冬タイヤ',
      unitCost: formatYen(tiresCustomer > 0 ? tires.unitCost : 0),
      total: formatYen(tiresCustomer),
    },
    {
      id: 'tax',
      label: '自動車税',
      unitCost: formatYen(taxCustomer > 0 ? tax.unitCost : 0),
      total: formatYen(taxCustomer),
    },
    {
      id: 'insurance',
      label: '任意保険',
      unitCost: insuranceState
        ?? (insuranceCustomer > 0 ? `${formatYen(insurance.unitCost)}/月` : formatYen(0)),
      total: insuranceState
        ?? formatYen(insuranceCustomer),
    },
  ]

  if (repair.total > 0) {
    rows.push({
      id: 'repair',
      label: '修理費用',
      unitCost: formatYen(repair.unitCost),
      total: formatYen(repair.total),
    })
  }

  rows.push({
    id: 'total',
    label: '維持費合計',
    unitCost: '',
    total: formatYen(plan.maintenanceCoverage.customerCost),
    totalRow: true,
  })
  return rows
}

function printCadenceRows(plans: PlanResult[], scenario: Scenario) {
  const definitions: { id: MaintenanceItemId; label: string }[] = [
    { id: 'inspection', label: '車検' },
    { id: 'legalInspection', label: '法定12か月点検' },
    { id: 'sixMonthInspection', label: '6か月点検' },
    { id: 'tires', label: '夏・冬タイヤ' },
    { id: 'tax', label: '自動車税' },
    { id: 'insurance', label: '任意保険' },
  ]
  if (plans.some((plan) => maintenanceItem(plan, 'repair').total > 0)) {
    definitions.push({ id: 'repair', label: '修理費用' })
  }

  return definitions.map(({ id, label }) => {
    const items = plans.map((plan) => maintenanceItem(plan, id))
    const cycles = [...new Set(items.map((item) => item.cycleLabel))]
    const cycle = id === 'inspection' && cycles.length > 1
      ? '新車：初回3年後／中古車・現状：次回指定（以後2年ごと）'
      : cycles.join('／')
    const counts = plans.map((plan, index) => {
      if (id !== 'insurance') return `${items[index].count}回`
      const purchaseMaintenance = purchaseMaintenanceForPlan(plan, scenario)
      const insuranceBlank = plan.planId === 'statusQuo'
        ? scenario.currentCar.monthlyInsurance === ''
        : purchaseMaintenance?.monthlyInsurance === ''
      if (plan.planId !== 'statusQuo' && !purchaseMaintenance?.includeInsurance) {
        return '対象外'
      }
      return insuranceBlank ? '未入力' : `${items[index].count}か月`
    })
    return { id, label, cycle, counts }
  })
}

export function EffectiveTotalChart({ plans }: { plans: PlanResult[] }) {
  const visiblePlans = plans.filter((plan) => plan.isVisible && plan.isComplete)
  const comparableTotal = (plan: PlanResult) => plan.effectiveTotal
  const maximum = Math.max(1, ...visiblePlans.map(comparableTotal))

  return (
    <section className="effective-chart" aria-labelledby="effective-chart-title">
      <div>
        <p className="eyebrow">Total Cost Comparison</p>
        <h2 id="effective-chart-title">プラン別実質総額</h2>
      </div>
      <ul>
        {visiblePlans.map((plan) => {
          const total = comparableTotal(plan)
          const width = total > 0
            ? Math.max(2, (total / maximum) * 100)
            : 0
          const valueLabel = formatYen(total)
          return (
            <li
              className={`effective-chart__item effective-chart__item--${plan.planId}`}
              key={plan.planId}
            >
              <div className="effective-chart__label">
                <strong>{plan.label}</strong>
                <span>
                  {plan.maintenanceYears}年維持
                  {getModeLabel(plan) ? `・${getModeLabel(plan)}` : ''}
                </span>
                <em className="effective-chart__tag">{getChartTag(plan)}</em>
              </div>
              <div
                className="effective-chart__track"
                role="img"
                aria-label={`${plan.label} 実質総額 ${valueLabel}`}
              >
                <span
                  className="effective-chart__bar"
                  style={{ '--bar-size': `${width}%` } as CSSProperties}
                />
              </div>
              <strong className="effective-chart__value">{valueLabel}</strong>
            </li>
          )
        })}
      </ul>
      {visiblePlans.length === 0 && (
        <p className="empty-comparison">入力が完了したプランの実質総額を表示します。</p>
      )}
    </section>
  )
}

export function PlanMaintenanceMatrix({
  plans,
  scenario,
}: {
  plans: PlanResult[]
  scenario: Scenario
}) {
  const visiblePlans = plans.filter((plan) => plan.isVisible && plan.isComplete)
  const cadenceRows = printCadenceRows(visiblePlans, scenario)

  return (
    <>
      <div className={`print-maintenance-details${visiblePlans.length === 5 ? ' has-five-plans' : ''}`}>
        {visiblePlans.map((plan) => (
          <article
            className={`print-maintenance-plan${plan.planId === 'omatome' ? ' is-omatome' : ''}`}
            key={plan.planId}
            aria-label={`${plan.label} 維持費金額`}
          >
            <h3>
              <span>{plan.label}<small>{getPlanContextLabel(plan)}</small></span>
              <small>{plan.maintenanceYears}年維持</small>
            </h3>
            <table>
              <thead>
                <tr>
                  <th scope="col">項目</th>
                  <th scope="col">1回あたり</th>
                  <th scope="col">合計</th>
                </tr>
              </thead>
              <tbody>
                {printMaintenanceRows(plan, scenario).map((row) => (
                  <tr className={row.totalRow ? 'is-total' : ''} key={row.id}>
                    <th scope="row">{row.label}</th>
                    <td>{row.unitCost}</td>
                    <td>{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {plan.planId === 'omatome' && (
              <p className="print-omatome-note">
                車検・点検・夏冬タイヤ・自動車税は
                {plan.maintenanceCoverage.includedThroughMonths / 12}年までリース料込み
              </p>
            )}
          </article>
        ))}
      </div>

      <section className="print-maintenance-cadence" aria-labelledby="maintenance-cadence-title">
        <h3 id="maintenance-cadence-title">回数・周期の算定条件</h3>
        <table>
          <thead>
            <tr>
              <th scope="col">項目</th>
              <th scope="col">周期</th>
              {visiblePlans.map((plan) => (
                <th scope="col" key={plan.planId}>
                  <span>{plan.label}</span>
                  <small>{plan.maintenanceYears}年維持</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cadenceRows.map((row) => (
              <tr key={row.id}>
                <th scope="row">{row.label}</th>
                <td>{row.cycle}</td>
                {row.counts.map((count, index) => (
                  <td key={`${row.id}-${visiblePlans[index].planId}`}>{count}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="maintenance-plan-cards">
        {visiblePlans.map((plan) => (
          <article className="maintenance-plan-card" key={plan.planId}>
            <h3>{plan.label}</h3>
            <p>
              {plan.maintenanceYears}年維持
              {getModeLabel(plan) ? `・${getModeLabel(plan)}` : ''}
            </p>
            <dl>
              {maintenanceRows
                .filter((row) => row.key !== 'repairCost' || plan.maintenance.repairCost > 0)
                .map((row) => (
                <div key={row.key}>
                  <dt>{row.label}</dt>
                  <dd>{maintenanceValue(plan, row.key, scenario)}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </div>

      {visiblePlans.length === 0 && (
        <p className="empty-comparison">入力が完了したプランの維持費内訳を表示します。</p>
      )}

    </>
  )
}

export function QuoteSummary({
  scenario,
  result,
}: {
  scenario: Scenario
  result: ComparisonResult
}) {
  const items = [
    ['車種', scenario.quote.carName || '未入力'],
    ['グレード', scenario.quote.grade || '未入力'],
    ['お客様名', scenario.quote.customerName || '未入力'],
    ['担当者名', scenario.quote.staffName || '未入力'],
    ['作成日', scenario.quote.quoteDate || '未入力'],
    [
      '新車見積総額',
      scenario.vehicle.estimateTotal === '' ? '未入力' : formatYen(result.newVehicleEstimateTotal),
    ],
    ...(result.usedCarPurchasePrice > 0
      ? [['中古車購入金額', formatYen(result.usedCarPurchasePrice)]]
      : []),
    [
      result.cashCreditPriceBasis === 'used'
        ? '下取り控除後中古車金額'
        : '下取り控除後新車金額',
      scenario.vehicle.estimateTotal === ''
        || (result.cashCreditPriceBasis === 'used' && result.usedCarPurchasePrice === 0)
        ? '未入力'
        : formatYen(result.cashCreditPurchaseAmount),
    ],
  ]

  return (
    <dl className="quote-summary">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}
