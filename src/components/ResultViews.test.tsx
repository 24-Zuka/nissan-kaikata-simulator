import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { calculateComparison } from '../domain/comparison'
import { createInitialScenario } from '../domain/defaults'
import { formatYen } from '../domain/money'
import type { Scenario } from '../domain/types'
import {
  PlanMaintenanceMatrix,
  PrintComparisonTable,
  ScreenComparisonTable,
} from './ResultViews'

function printScenario(): Scenario {
  const scenario = createInitialScenario()
  scenario.vehicle.estimateTotal = 5_000_000
  scenario.currentCar.firstRegistrationMonth = '2021-01'
  scenario.newMaintenance.monthlyInsurance = 8_000
  scenario.newMaintenance.repairCost = 80_000
  scenario.omatome.firstPayment = 90_000
  scenario.omatome.monthlyPayment = 80_000
  scenario.omatome.finalPayment = 1_000_000
  scenario.bvc.residualValue = 1_800_000
  scenario.omatome.included.insurance = false
  return scenario
}

function rowByLabel(container: HTMLElement, label: string) {
  return within(container).getAllByRole('row').find(
    (row) => row.querySelector('th')?.textContent === label,
  )!
}

describe('PlanMaintenanceMatrix print presentation', () => {
  it('shows only separately paid omatome maintenance as customer cost', () => {
    const scenario = printScenario()
    const result = calculateComparison(scenario)
    const { rerender } = render(
      <PlanMaintenanceMatrix plans={result.plans} scenario={scenario} />,
    )
    const omatome = screen.getByLabelText('おまとめプラン 維持費金額')

    for (const label of ['車検', '夏・冬タイヤ', '自動車税']) {
      expect(within(rowByLabel(omatome, label)).getAllByText('0円')).toHaveLength(2)
    }
    expect(within(rowByLabel(omatome, '点検')).getAllByText('0円')).toHaveLength(3)
    expect(rowByLabel(omatome, '任意保険')).toHaveTextContent('8,000円/月')
    expect(rowByLabel(omatome, '任意保険')).toHaveTextContent('480,000円')
    expect(rowByLabel(omatome, '修理費用')).toHaveTextContent('80,000円')
    expect(rowByLabel(omatome, '維持費合計')).toHaveTextContent('560,000円')
    expect(screen.queryByText('本来発生する維持費')).not.toBeInTheDocument()

    scenario.omatome.included.insurance = true
    const includedResult = calculateComparison(scenario)
    rerender(
      <PlanMaintenanceMatrix plans={includedResult.plans} scenario={scenario} />,
    )
    const includedOmatome = screen.getByLabelText('おまとめプラン 維持費金額')
    expect(within(rowByLabel(includedOmatome, '任意保険')).getAllByText('0円')).toHaveLength(2)
    expect(rowByLabel(includedOmatome, '維持費合計')).toHaveTextContent('80,000円')
  })

  it('moves plan counts and shared cycles into a separate matrix', () => {
    const scenario = printScenario()
    scenario.currentCar.originalPurchasePrice = 1_800_000
    const result = calculateComparison(scenario)
    render(<PlanMaintenanceMatrix plans={result.plans} scenario={scenario} />)

    const cadence = screen.getByRole('heading', { name: '回数・周期の算定条件' })
      .closest('section')!
    expect(within(cadence).getByRole('columnheader', {
      name: '現状維持 5年維持',
    })).toBeInTheDocument()
    expect(within(cadence).getByRole('columnheader', {
      name: 'おまとめプラン 5年維持',
    })).toBeInTheDocument()
    expect(rowByLabel(cadence, '法定12か月点検')).toHaveTextContent('1年ごと')
    expect(rowByLabel(cadence, '6か月点検')).toHaveTextContent('6か月ごと')
    expect(screen.getAllByLabelText(/維持費金額$/)).toHaveLength(5)
  })

  it('renders all maintenance cards for the customer presentation surface', () => {
    const scenario = printScenario()
    scenario.currentCar.originalPurchasePrice = 1_800_000
    const result = calculateComparison(scenario)
    render(<PlanMaintenanceMatrix plans={result.plans} scenario={scenario} />)

    const cards = document.querySelectorAll('.maintenance-plan-cards .maintenance-plan-card')
    expect(cards).toHaveLength(5)
  })
})

describe('ScreenComparisonTable', () => {
  it('shows plans as rows with the calculated customer-facing values', () => {
    const scenario = printScenario()
    const result = calculateComparison(scenario)
    render(<ScreenComparisonTable plans={result.plans} scenario={scenario} />)

    const cash = result.plans.find((plan) => plan.planId === 'cash')!
    const cashRow = screen.getByRole('row', { name: /現金一括/ })
    expect(within(cashRow).getByText(formatYen(cash.effectiveMonthly))).toBeInTheDocument()
    expect(within(cashRow).getByText(formatYen(cash.effectiveTotal))).toBeInTheDocument()
    expect(within(cashRow).getByText(`${cash.maintenanceYears}年`)).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: '顧客負担維持費' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: '満了時' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: '任意保険' })).toBeInTheDocument()
  })
})

describe('PrintComparisonTable', () => {
  it('uses the print-only row order and omits completion and insurance rows', () => {
    const scenario = printScenario()
    const result = calculateComparison(scenario)
    render(<PrintComparisonTable plans={result.plans} />)

    const rowLabels = screen.getAllByRole('row')
      .slice(1)
      .map((row) => row.querySelector('th')?.textContent)

    expect(rowLabels).toEqual([
      '支払い回数',
      '購入時支払',
      '月あたりの支払',
      'ボーナス支払',
      '車両購入金額',
      '最終回/残債',
      '満了時の扱い',
      '顧客負担維持費',
      '実質月額',
      '実質支払額',
    ])
    expect(screen.queryByText('任意保険')).not.toBeInTheDocument()
    expect(screen.queryByText('入力済み')).not.toBeInTheDocument()
    expect(screen.queryByText('要入力')).not.toBeInTheDocument()
    expect(rowByLabel(document.body, '実質月額')).toHaveClass('print-emphasis-monthly')
    expect(rowByLabel(document.body, '実質支払額')).toHaveClass('print-emphasis-total')
  })
})
