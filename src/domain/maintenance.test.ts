import { describe, expect, it } from 'vitest'
import { calculateMaintenance } from './maintenance'

const baseInput = {
  comparisonMonths: 60,
  inspectionCost: 150_000,
  legalInspectionCost: 34_650,
  sixMonthInspectionCost: 17_600,
  tireCost: 300_000,
  annualTax: 36_000,
  monthlyInsurance: '',
  repairCost: '',
  tireCycleYears: 4,
  includeInsurance: true,
} as const

describe('calculateMaintenance', () => {
  it('uses the new-car inspection schedule and removes overlapping checks', () => {
    const result = calculateMaintenance({
      ...baseInput,
      vehicleCondition: 'new',
      nextInspectionMonths: '',
    })

    expect(result.inspectionMonths).toEqual([36])
    expect(result.legalInspectionMonths).toEqual([12, 24, 48, 60])
    expect(result.sixMonthInspectionMonths).toEqual([6, 18, 30, 42, 54])
    expect(result.breakdown.find((item) => item.id === 'tax')?.count).toBe(5)
    expect(result.breakdown.find((item) => item.id === 'tires')?.count).toBe(1)
  })

  it('does not count inspections that fall on the final maintenance month', () => {
    const sevenYears = calculateMaintenance({
      ...baseInput,
      comparisonMonths: 84,
      vehicleCondition: 'new',
      nextInspectionMonths: '',
    })
    const nineYears = calculateMaintenance({
      ...baseInput,
      comparisonMonths: 108,
      vehicleCondition: 'new',
      nextInspectionMonths: '',
    })
    const usedFinalMonth = calculateMaintenance({
      ...baseInput,
      comparisonMonths: 60,
      vehicleCondition: 'used',
      nextInspectionMonths: 60,
    })

    expect(sevenYears.inspectionMonths).toEqual([36, 60])
    expect(nineYears.inspectionMonths).toEqual([36, 60, 84])
    expect(usedFinalMonth.inspectionMonths).toEqual([])
  })

  it('starts used-car inspections from the entered remaining months', () => {
    const result = calculateMaintenance({
      ...baseInput,
      vehicleCondition: 'used',
      nextInspectionMonths: 8,
    })

    expect(result.inspectionMonths).toEqual([8, 32, 56])
    expect(result.warnings).toEqual([])
  })

  it('does not invent a used-car inspection when the remaining months are blank', () => {
    const result = calculateMaintenance({
      ...baseInput,
      vehicleCondition: 'used',
      nextInspectionMonths: '',
    })

    expect(result.inspectionMonths).toEqual([])
    expect(result.warnings[0]).toContain('未入力')
  })

  it('shows the full five-year cost basis including repair', () => {
    const result = calculateMaintenance({
      ...baseInput,
      inspectionCost: 100_000,
      legalInspectionCost: 15_000,
      sixMonthInspectionCost: 15_000,
      tireCost: 120_000,
      tireCycleYears: 3,
      annualTax: 30_500,
      monthlyInsurance: 8_000,
      repairCost: 80_000,
      vehicleCondition: 'new',
      nextInspectionMonths: '',
    })

    expect(result.breakdown.find((item) => item.id === 'inspection')).toMatchObject({
      unitCost: 100_000,
      count: 1,
      total: 100_000,
    })
    expect(result.breakdown.find((item) => item.id === 'legalInspection')?.count).toBe(4)
    expect(result.breakdown.find((item) => item.id === 'sixMonthInspection')?.count).toBe(5)
    expect(result.breakdown.find((item) => item.id === 'tires')).toMatchObject({ count: 1, total: 120_000 })
    expect(result.breakdown.find((item) => item.id === 'tax')).toMatchObject({ count: 5, total: 152_500 })
    expect(result.breakdown.find((item) => item.id === 'insurance')).toMatchObject({ count: 60, total: 480_000 })
    expect(result.breakdown.find((item) => item.id === 'repair')).toMatchObject({ count: 1, total: 80_000 })
    expect(result.total).toBe(1_067_500)
  })
})
