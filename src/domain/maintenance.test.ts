import { describe, it, expect } from 'vitest'
import {
  calculateMaintenance,
  countInspections,
  countTireReplacements,
} from './maintenance'
import { createDefaultMaintenance } from './constants'
import type { MaintenanceInput } from './types'

describe('回数計算', () => {
  it('新車車検: 5年で初回3年+5年 = 2回', () => {
    expect(countInspections(5, 'new')).toBe(2)
    expect(countInspections(3, 'new')).toBe(1)
    expect(countInspections(2, 'new')).toBe(0)
    expect(countInspections(7, 'new')).toBe(3)
  })
  it('中古車検: 2年ごと', () => {
    expect(countInspections(5, 'used')).toBe(2)
    expect(countInspections(4, 'used')).toBe(2)
  })
  it('タイヤ: 周期年ごと', () => {
    expect(countTireReplacements(5, 3)).toBe(1)
    expect(countTireReplacements(6, 3)).toBe(2)
    expect(countTireReplacements(5, 0)).toBe(0)
  })
})

describe('calculateMaintenance', () => {
  it('タイヤ項目の表示名は「夏・冬タイヤ」（タイヤ交換ではない）', () => {
    const m = calculateMaintenance(createDefaultMaintenance('small'), {
      vehicleMode: 'new',
      years: 5,
    })
    const tire = m.items.find((i) => i.key === 'tires')
    expect(tire?.label).toBe('夏・冬タイヤ')
    expect(m.items.some((i) => i.label.includes('タイヤ交換'))).toBe(false)
  })

  it('任意保険: 未入力(includeInsurance=false)は entered=false / total=0', () => {
    const m = calculateMaintenance(createDefaultMaintenance('small'), {
      vehicleMode: 'new',
      years: 5,
    })
    expect(m.insuranceEntered).toBe(false)
    expect(m.insuranceTotal).toBe(0)
    const ins = m.items.find((i) => i.key === 'insurance')
    expect(ins?.entered).toBe(false)
    expect(ins?.total).toBe(0)
  })

  it('任意保険: includeInsurance=true かつ金額入力で計上', () => {
    const input: MaintenanceInput = {
      ...createDefaultMaintenance('small'),
      includeInsurance: true,
      insuranceMonthly: 8000,
    }
    const m = calculateMaintenance(input, { vehicleMode: 'new', years: 5 })
    expect(m.insuranceEntered).toBe(true)
    expect(m.insuranceTotal).toBe(8000 * 12 * 5)
  })

  it('全項目の合計が非負整数で byKey と一致', () => {
    const m = calculateMaintenance(createDefaultMaintenance('medium'), {
      vehicleMode: 'new',
      years: 7,
    })
    let sum = 0
    for (const it of m.items) {
      expect(Number.isInteger(it.total)).toBe(true)
      expect(it.total).toBeGreaterThanOrEqual(0)
      sum += it.total
    }
    expect(sum).toBe(m.total)
  })

  it('不正入力でもクラッシュしない', () => {
    const broken = {
      simulationYears: NaN,
      inspectionCost: 'abc',
      legalInspectionCost: -1,
      sixMonthInspectionCost: Infinity,
      annualTax: undefined,
      tireCost: null,
      tireReplacementCycleYears: -3,
      insuranceMonthly: '',
      includeInsurance: true,
    } as unknown as MaintenanceInput
    const m = calculateMaintenance(broken, { vehicleMode: 'new', years: NaN as unknown as number })
    expect(m.total).toBe(0)
  })
})
