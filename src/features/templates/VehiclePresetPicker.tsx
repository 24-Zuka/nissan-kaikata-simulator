import { useId, useRef, useState } from 'react'
import catalog from '../../data/fourWheelGrades.json'
import type { Scenario } from '../../domain/types'
import { applyTemplate, createBlankScenario, type ModelTemplate } from './modelTemplates'
import { filterVehicleModels } from './vehicleModelSearch'
export function VehiclePresetPicker({ scenario, templates, onChange }: { scenario: Scenario; templates: ModelTemplate[]; onChange: (s: Scenario) => void }) {
  const [query, setQuery] = useState('')
  const searchId = useId()
  const searchInput = useRef<HTMLInputElement>(null)
  const [model, setModel] = useState(scenario.quote.carName)
  const [gradeKey, setGradeKey] = useState(() => catalog.find(r=>r.model===scenario.quote.carName&&r.grade===scenario.quote.grade&&r.drive===scenario.quote.drive)?.id || (()=>{const t=templates.find(t=>t.model===scenario.quote.carName&&t.grade===scenario.quote.grade&&t.drive===scenario.quote.drive);return t?'custom:'+t.id:''})())
  const [templateId, setTemplateId] = useState('')
  const models = [...new Set([...catalog.map(r => r.model), ...templates.map(t => t.model)])]
  const filteredModels = filterVehicleModels(models, query)
  const selectedOutsideSearch = Boolean(model && !filteredModels.includes(model))
  const options = [...catalog.filter(r => r.model === model)]
  for (const t of templates.filter(t => t.model === model)) if (!options.some(r => r.grade === t.grade && r.drive === t.drive)) options.push({id:'custom:'+t.id,model:t.model,grade:t.grade,drive:t.drive,status:'自分で追加・適用条件を確認',checkedAt:t.updatedAt.slice(0,10),source:'',sourceGroup:''})
  const row = options.find(r => r.id === gradeKey)
  const matches = row ? templates.filter(t => t.model === row.model && t.grade === row.grade && t.drive === row.drive) : []
  const start = () => {
    if (!row) return
    const template = matches.length === 1 ? matches[0] : matches.find(t => t.id === templateId)
    if (matches.length > 1 && !template) return
    if (!confirm(`${row.model} ${row.grade}（${row.drive}）${template ? 'の登録済み概算条件を読み込みます' : 'を金額未設定で開始します'}。現在の購入車・支払条件・維持費は置き換わります。よろしいですか？`)) return
    if (template) onChange(applyTemplate(scenario, template))
    else {
      const next = createBlankScenario()
      next.quote = { ...scenario.quote, carName: row.model, grade: row.grade, drive: row.drive, amountStatus: 'unreviewed' }
      next.currentCar = structuredClone(scenario.currentCar);next.customerLink = scenario.customerLink ? structuredClone(scenario.customerLink) : undefined
      next.vehicle.tradeIn = scenario.vehicle.tradeIn
      next.comparison.enabledPlans = {cash:false,credit:false,bvc:false,omatome:false}
      onChange(next)
    }
  }
  return <section className="template-panel no-print" aria-label="車種とグレードから条件を呼び出す">
    <h2>購入する車種・4WDグレード</h2>
    <div className="vehicle-model-search">
      <label htmlFor={searchId}>車名で検索</label>
      <div className="vehicle-model-search__controls">
        <input id={searchId} ref={searchInput} type="search" value={query} placeholder="例：のーと、セレナ、X-TRAIL" autoComplete="off" aria-describedby={`${searchId}-results`} onChange={e => setQuery(e.target.value)} />
        <button type="button" className="button button--quiet" aria-label="車名検索をクリア" disabled={!query} onClick={() => {setQuery('');searchInput.current?.focus()}}>クリア</button>
      </div>
      <p id={`${searchId}-results`} className="field__hint" aria-live="polite">
        {filteredModels.length ? `${filteredModels.length}車種の候補から選べます。検索だけでは車種や金額は変わりません。` : '該当する車種はありません。別の車名で検索するか、検索をクリアしてください。一覧にない車種は詳細入力で手入力できます。'}
        {selectedOutsideSearch && ` 選択中の「${model}」とグレードは保持しています。`}
      </p>
    </div>
    <div className="form-grid">
      <label>車種を選択<select aria-label="車種を選択" value={model} onChange={e => {setModel(e.target.value);setGradeKey('');setTemplateId('')}}><option value="">選択してください</option>{selectedOutsideSearch&&<option value={model}>{model}（選択中）</option>}{filteredModels.map(m=><option key={m} value={m}>{m}</option>)}</select></label>
      <label>グレードを選択<select aria-label="グレードを選択" value={gradeKey} onChange={e=>{setGradeKey(e.target.value);setTemplateId('')}}><option value="">選択してください</option>{options.map(r=><option key={r.id} value={r.id}>{r.grade} · {r.drive}{r.status.startsWith('発売前')?' · 発売前':''}</option>)}</select></label>
    </div>
    {row && <><p>{row.status} ／ 確認日 {row.checkedAt} {row.source&&<a href={row.source} target="_blank" rel="noreferrer">公式出典</a>}</p><p>{matches.length ? `完全一致の概算設定：${matches.length}件` : '一致する登録額はありません。金額を空欄にして手入力できます。別グレードの金額は使用しません。'}</p></>}
    {matches.length>1&&<select aria-label="一致した概算設定" value={templateId} onChange={e=>setTemplateId(e.target.value)}><option value="">使用する設定を選択</option>{matches.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>}
    <button className="button button--primary" disabled={!row||(matches.length>1&&!templateId)} onClick={start}>{matches.length?'一致した概算設定を読み込む':'この車種で手入力を開始'}</button>
    <p className="field__hint">金額は読み込み後も変更できます。一覧にない車種・グレードは詳細入力で手入力、または設定で追加できます。商用・法人限定・2WDは候補対象外。福祉仕様は4WD適用を確認できた仕様を掲載しています。購入条件・受注可否は販売店で確認してください。</p>
  </section>
}
