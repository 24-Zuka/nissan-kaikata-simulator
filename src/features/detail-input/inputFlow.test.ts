import { describe, expect, it } from 'vitest'
import { calculateComparison } from '../../domain/comparison'
import { createInitialScenario } from '../../domain/defaults'
import {
  getFirstIncompleteStage,
  getIssueStage,
  getPresentationReadiness,
  getStageIssues,
} from './inputFlow'

describe('input flow', () => {
  it('maps plan selection validation to the comparison stage', () => {
    const scenario = createInitialScenario()
    scenario.comparison.enabledPlans = {
      cash: false,
      credit: false,
      bvc: false,
      omatome: false,
    }
    const result = calculateComparison(scenario)
    const issue = result.validationIssues.find((item) => item.fieldId === 'enabledPlans')!

    expect(getIssueStage(issue)).toBe('plans')
    expect(getStageIssues(result, 'plans')).toContain(issue)
  })

  it('returns the first stage with missing required input', () => {
    const result = calculateComparison(createInitialScenario())

    expect(getFirstIncompleteStage(result)).toBe('dealVehicle')
  })

  it('requires two completed plans for a customer comparison', () => {
    const scenario = createInitialScenario()
    scenario.comparison.enabledPlans = {
      cash: true,
      credit: false,
      bvc: false,
      omatome: false,
    }
    scenario.vehicle.estimateTotal = 4_000_000
    const result = calculateComparison(scenario)

    expect(getPresentationReadiness(result)).toMatchObject({
      canCompare: false,
      completePlanCount: 1,
      incompletePlanCount: 0,
    })
  })
})
