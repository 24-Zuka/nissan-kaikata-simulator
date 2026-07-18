import type { ComparisonResult, ScenarioSectionId } from '../domain/types'

const SECTION_LABELS: Record<ScenarioSectionId, string> = {
  quote: '商談情報',
  vehicle: '車両・購入金額',
  currentCar: '現在の車',
  newMaintenance: '新車の維持費',
  usedMaintenance: '中古車の維持費',
  cash: '現金一括',
  credit: 'クレジット',
  bvc: 'BVC',
  omatome: 'おまとめ',
}

const SECTION_ORDER = Object.keys(SECTION_LABELS) as ScenarioSectionId[]

export function InputProgress({ result }: { result: ComparisonResult }) {
  const enabledPlans = result.scenario.comparison.enabledPlans
  const activeSections = SECTION_ORDER.filter((sectionId) =>
    !(['cash', 'credit', 'bvc', 'omatome'] as ScenarioSectionId[]).includes(sectionId)
      || enabledPlans[sectionId as keyof typeof enabledPlans],
  )
  const errorsBySection = new Map<ScenarioSectionId, number>()
  for (const issue of result.validationIssues) {
    if (issue.severity !== 'error') continue
    errorsBySection.set(issue.sectionId, (errorsBySection.get(issue.sectionId) ?? 0) + 1)
  }
  const firstIssue = result.validationIssues.find((issue) => issue.severity === 'error')
  const completed = activeSections.length - errorsBySection.size
  const percent = Math.round((completed / activeSections.length) * 100)

  return (
    <nav className="input-progress" aria-label="入力進捗">
      <div className="input-progress__summary">
        <div>
          <span>入力進捗</span>
          <strong>{errorsBySection.size === 0 ? '入力完了' : `未入力 ${result.validationIssues.length}件`}</strong>
        </div>
        <span>{percent}%</span>
      </div>
      <div
        className="input-progress__bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      <ul>
        {activeSections.map((sectionId) => {
          const errorCount = errorsBySection.get(sectionId) ?? 0
          return (
            <li key={sectionId}>
              <a href={`#section-${sectionId}`}>
                <span>{SECTION_LABELS[sectionId]}</span>
                <small>{errorCount ? `${errorCount}件` : '完了'}</small>
              </a>
            </li>
          )
        })}
      </ul>
      {firstIssue && (
        <a className="button button--primary input-progress__next" href={`#section-${firstIssue.sectionId}`}>
          次の未入力へ
        </a>
      )}
    </nav>
  )
}
