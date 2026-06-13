import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PrintView } from './PrintView'
import { calculateScenario } from '../../domain/scenario'
import { getStatusQuoVisibility } from '../../domain/visibility'
import { makeScenario } from '../../test/helpers/makeScenario'

function renderPrint(scenario = makeScenario({ vehiclePrice: 2_500_000, quoteDate: '2026-06-13' })) {
  const result = calculateScenario(scenario)
  const visibility = getStatusQuoVisibility(scenario.currentCar)
  const utils = render(<PrintView scenario={scenario} result={result} visibility={visibility} />)
  return { ...utils, scenario, result }
}

describe('印刷ビュー', () => {
  it('上段に比較表、下段に維持費用内訳がある（DOM順）', () => {
    const { container } = renderPrint()
    const top = container.querySelector('.printsheet__block--top')
    const bottom = container.querySelector('.printsheet__block--bottom')
    expect(top?.querySelector('.cmp__table')).toBeTruthy()
    expect(bottom?.querySelector('.mtn__table')).toBeTruthy()
    // DOM順序: top が bottom より前
    const blocks = Array.from(container.querySelectorAll('.printsheet__block'))
    expect(blocks.indexOf(top as Element)).toBeLessThan(blocks.indexOf(bottom as Element))
  })

  it('作成日が1箇所のみ', () => {
    renderPrint()
    const matches = screen.getAllByText(/作成日/)
    expect(matches.length).toBe(1)
  })

  it('QRコード(canvas/img)が無い', () => {
    const { container } = renderPrint()
    expect(container.querySelector('canvas')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
  })

  it('「リース」「タイヤ交換」が無く「夏・冬タイヤ」がある', () => {
    renderPrint()
    expect(screen.queryByText(/リース/)).toBeNull()
    expect(screen.queryByText(/タイヤ交換/)).toBeNull()
    expect(screen.getByText('夏・冬タイヤ')).toBeTruthy()
  })

  it('維持費用内訳が「1回あたり/月額」と周期で表示される', () => {
    renderPrint()
    expect(screen.getByText('1回あたり / 月額')).toBeTruthy()
    expect(screen.getByText('発生周期')).toBeTruthy()
  })

  it('任意保険 未入力時は初期金額を表示せず「未入力」', () => {
    renderPrint()
    expect(screen.getByText('未入力')).toBeTruthy()
  })
})
