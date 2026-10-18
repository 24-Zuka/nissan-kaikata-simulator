import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import catalog from '../../data/fourWheelGrades.json'
import { VehiclePresetPicker } from './VehiclePresetPicker'
import { createBlankScenario, templateFromScenario } from './modelTemplates'
import { filterVehicleModels } from './vehicleModelSearch'

const models = [...new Set(catalog.map(row => row.model))]
describe('vehicle name search', () => {
  it.each([
    ['のーと', ['ノート', 'ノート オーラ']],
    ['ﾉｰﾄ', ['ノート', 'ノート オーラ']],
    ['ＮＯＴＥ', ['ノート', 'ノート オーラ']],
    [' aura ', ['ノート オーラ']],
    ['せれ', ['セレナ']],
    ['SERENA', ['セレナ']],
    ['X TRAIL', ['エクストレイル']],
    ['x-tr', ['エクストレイル']],
    ['ありあ', ['日産アリア']],
    ['ARIYA', ['日産アリア']],
    ['roox', ['ルークス']],
    ['clipper', ['クリッパーリオ']],
    ['dayz', ['デイズ']],
    ['elgrand', ['エルグランド']],
    ['kicks', ['キックス']],
    ['murano', ['ムラーノ']],
    ['ない車種', []],
  ])('filters %s without changing catalogue values', (query, expected) => {
    expect(filterVehicleModels(models, query)).toEqual(expected)
  })
  it('returns all models for empty or whitespace input, and searches custom names', () => {
    expect(filterVehicleModels(models, '')).toEqual(models)
    expect(filterVehicleModels(models, '　 ')).toEqual(models)
    expect(filterVehicleModels(['テスト車', 'Custom Model'], 'てすと')).toEqual(['テスト車'])
    expect(filterVehicleModels(['テスト車', 'Custom Model'], 'custom')).toEqual(['Custom Model'])
  })
  it('preserves the selected car, grade and amount while filtering, clearing or finding no match', async () => {
    const user = userEvent.setup(), scenario = createBlankScenario(), onChange = vi.fn()
    scenario.quote.carName = 'ノート'; scenario.quote.grade = 'X FOUR'; scenario.quote.drive = '4WD'
    scenario.vehicle.estimateTotal = 3000000
    const before = structuredClone(scenario)
    render(<VehiclePresetPicker scenario={scenario} templates={[]} onChange={onChange} />)
    const search = screen.getByRole('searchbox', { name: '車名で検索' })
    const model = screen.getByLabelText('車種を選択'), grade = screen.getByLabelText('グレードを選択')
    const selectedGrade = (grade as HTMLSelectElement).value
    await user.type(search, 'serena')
    expect(within(model).getAllByRole('option').map(x => x.textContent)).toEqual(['選択してください', 'ノート（選択中）', 'セレナ'])
    expect(model).toHaveValue('ノート'); expect(grade).toHaveValue(selectedGrade)
    await user.clear(search); await user.type(search, '該当なし')
    expect(screen.getByText(/該当する車種はありません/)).toBeInTheDocument()
    expect(model).toHaveValue('ノート'); expect(grade).toHaveValue(selectedGrade)
    await user.click(screen.getByRole('button', { name: '車名検索をクリア' }))
    expect(search).toHaveValue(''); expect(search).toHaveFocus()
    expect(within(model).getAllByRole('option')).toHaveLength(models.length + 1)
    expect(onChange).not.toHaveBeenCalled(); expect(scenario).toEqual(before)
  })
  it('updates only the available grades on selection and applies exact preset prices only after confirmation', async () => {
    const user = userEvent.setup(), scenario = createBlankScenario(), onChange = vi.fn()
    scenario.vehicle.estimateTotal = 1234567
    const preset = templateFromScenario(scenario, { id: 'search-test', name: '架空ノート', model: 'ノート', grade: 'X FOUR', drive: '4WD' })
    preset.terms.vehicle.estimateTotal = 3000000
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<VehiclePresetPicker scenario={scenario} templates={[preset]} onChange={onChange} />)
    await user.type(screen.getByRole('searchbox', { name: '車名で検索' }), 'note')
    await user.selectOptions(screen.getByLabelText('車種を選択'), 'ノート')
    const grade = screen.getByLabelText('グレードを選択')
    expect(within(grade).getAllByRole('option').slice(1).map(o => o.textContent)).toEqual(catalog.filter(r => r.model === 'ノート').map(r => `${r.grade} · ${r.drive}`))
    await user.selectOptions(grade, catalog.find(r => r.model === 'ノート' && r.grade === 'X FOUR')!.id)
    expect(onChange).not.toHaveBeenCalled(); expect(confirm).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: '一致した概算設定を読み込む' }))
    expect(confirm).toHaveBeenCalledOnce()
    expect(onChange.mock.calls[0][0].vehicle.estimateTotal).toBe(3000000)
    expect(onChange.mock.calls[0][0].quote).toMatchObject({ carName: 'ノート', grade: 'X FOUR', drive: '4WD' })
    confirm.mockRestore()
  })
})
