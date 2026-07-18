import type { ComparisonResult } from '../domain/types'
import {
  getFirstIncompleteStage,
  getStageIssues,
  INPUT_STAGES,
  type InputStageId,
} from '../features/detail-input/inputFlow'

type Props = {
  result: ComparisonResult
  activeStage: InputStageId
  onStageChange: (stageId: InputStageId) => void
}

export function InputProgress({ result, activeStage, onStageChange }: Props) {
  const errorCount = result.validationIssues.filter((issue) => issue.severity === 'error').length
  const completed = INPUT_STAGES.filter(
    (stage) => getStageIssues(result, stage.id).length === 0,
  ).length
  const percent = Math.round((completed / INPUT_STAGES.length) * 100)
  const firstIncompleteStage = getFirstIncompleteStage(result)

  return (
    <nav className="input-progress" aria-label="入力ステップ">
      <div className="input-progress__summary">
        <div>
          <span>入力進捗</span>
          <strong>{errorCount === 0 ? '入力完了' : `未入力 ${errorCount}件`}</strong>
        </div>
        <span>{percent}%</span>
      </div>
      <div
        className="input-progress__bar"
        role="progressbar"
        aria-label="入力完了率"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <span style={{ width: `${percent}%` }} />
      </div>
      <ol className="input-progress__stages">
        {INPUT_STAGES.map((stage, index) => {
          const issues = getStageIssues(result, stage.id)
          const isActive = stage.id === activeStage
          return (
            <li key={stage.id}>
              <button
                aria-current={isActive ? 'step' : undefined}
                className={isActive ? 'is-active' : ''}
                onClick={() => onStageChange(stage.id)}
                type="button"
              >
                <span className="input-progress__index" aria-hidden="true">
                  {issues.length === 0 ? '✓' : index + 1}
                </span>
                <span>
                  <strong>{stage.label}</strong>
                  <small>{issues.length ? `未入力 ${issues.length}件` : '確認済み'}</small>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      {firstIncompleteStage && (
        <button
          className="button button--primary input-progress__next"
          onClick={() => onStageChange(firstIncompleteStage)}
          type="button"
        >
          次の未入力へ
        </button>
      )}
    </nav>
  )
}
