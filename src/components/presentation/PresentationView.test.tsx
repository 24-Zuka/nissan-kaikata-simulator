import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PresentationView } from './PresentationView'
import { calculateScenario } from '../../domain/scenario'
import { getStatusQuoVisibility } from '../../domain/visibility'
import { makeScenario } from '../../test/helpers/makeScenario'

function renderPresentation(scenario = makeScenario({ vehiclePrice: 2_500_000, taxAndFees: 200_000 })) {
  const result = calculateScenario(scenario)
  const visibility = getStatusQuoVisibility(scenario.currentCar)
  render(<PresentationView scenario={scenario} result={result} visibility={visibility} />)
  return { scenario, result, visibility }
}

describe('お客様説明モード 表示', () => {
  it('5プラン中、現金一括・クレジット・BVC・おまとめプランが表示される', () => {
    renderPresentation()
    expect(screen.getAllByText('おまとめプラン').length).toBeGreaterThan(0)
    expect(screen.getAllByText('現金一括').length).toBeGreaterThan(0)
    expect(screen.getAllByText('クレジット').length).toBeGreaterThan(0)
    expect(screen.getAllByText('BVC').length).toBeGreaterThan(0)
  })

  it('「リース」と表示されない', () => {
    renderPresentation()
    expect(screen.queryByText(/リース/)).toBeNull()
  })

  it('「タイヤ交換」ではなく「夏・冬タイヤ」と表示される', () => {
    renderPresentation()
    expect(screen.queryByText(/タイヤ交換/)).toBeNull()
    expect(screen.getAllByText('夏・冬タイヤ').length).toBeGreaterThan(0)
  })

  it('現状維持は未入力なら表示されない', () => {
    renderPresentation()
    expect(screen.queryByText('現状維持')).toBeNull()
  })

  it('過去購入額を入力すると現状維持が表示される', () => {
    const scenario = makeScenario({
      vehiclePrice: 2_500_000,
      currentCar: { ...makeScenario().currentCar, originalPurchasePrice: 2_000_000 },
    })
    renderPresentation(scenario)
    expect(screen.getAllByText('現状維持').length).toBeGreaterThan(0)
  })

  it('現金一括の月々の支払が金額（0円）で表示される', () => {
    renderPresentation()
    expect(screen.getByText(/一括（0円\/月）/)).toBeTruthy()
  })
})
