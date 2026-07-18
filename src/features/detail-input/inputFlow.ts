import type {
  ComparisonResult,
  ScenarioSectionId,
  ScenarioValidationIssue,
} from '../../domain/types'

export type InputStageId = 'dealVehicle' | 'plans' | 'maintenance' | 'payments'

export type FormInteractionState = {
  touchedFieldIds: ReadonlySet<string>
  attemptedStageIds: ReadonlySet<InputStageId>
}

export type PresentationReadiness = {
  canCompare: boolean
  completePlanCount: number
  incompletePlanCount: number
  incompletePlanLabels: string[]
}

export const INPUT_STAGES: ReadonlyArray<{
  id: InputStageId
  label: string
  shortLabel: string
  description: string
}> = [
  {
    id: 'dealVehicle',
    label: '商談・車両',
    shortLabel: '商談',
    description: '案件、車両、購入金額、現在の車',
  },
  {
    id: 'plans',
    label: '比較対象',
    shortLabel: 'プラン',
    description: '商談で見せる購入プラン',
  },
  {
    id: 'maintenance',
    label: '維持費',
    shortLabel: '維持費',
    description: '現在の車、新車、中古車の条件',
  },
  {
    id: 'payments',
    label: '支払条件',
    shortLabel: '支払',
    description: '現金、クレジット、BVC、おまとめ',
  },
]

const SECTION_STAGE: Record<ScenarioSectionId, InputStageId> = {
  quote: 'dealVehicle',
  vehicle: 'dealVehicle',
  currentCar: 'dealVehicle',
  newMaintenance: 'maintenance',
  usedMaintenance: 'maintenance',
  cash: 'payments',
  credit: 'payments',
  bvc: 'payments',
  omatome: 'payments',
}

export function getIssueStage(issue: ScenarioValidationIssue): InputStageId {
  if (issue.fieldId === 'enabledPlans') return 'plans'
  return SECTION_STAGE[issue.sectionId]
}

export function getStageIssues(
  result: ComparisonResult,
  stageId: InputStageId,
): ScenarioValidationIssue[] {
  return result.validationIssues.filter(
    (issue) => issue.severity === 'error' && getIssueStage(issue) === stageId,
  )
}

export function getFirstIncompleteStage(result: ComparisonResult): InputStageId | null {
  return INPUT_STAGES.find((stage) => getStageIssues(result, stage.id).length > 0)?.id ?? null
}

export function getPresentationReadiness(result: ComparisonResult): PresentationReadiness {
  return {
    canCompare: result.completePlans.length >= 2,
    completePlanCount: result.completePlans.length,
    incompletePlanCount: result.incompletePlans.length,
    incompletePlanLabels: result.incompletePlans.map((plan) => plan.label),
  }
}

export function fieldInteractionId(sectionId: ScenarioSectionId, fieldId: string): string {
  return `${sectionId}:${fieldId}`
}
