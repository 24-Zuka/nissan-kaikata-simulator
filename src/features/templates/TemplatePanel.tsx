import catalog from '../../data/fourWheelGrades.json'
import { useEffect, useState } from 'react'
import { NumberField, SelectField, TextField } from '../../components/FormControls'
import type { Scenario } from '../../domain/types'
import { applyTemplate, createTemplate, isModelTemplate, LINEUP_CHECKED_AT, LINEUP_SOURCE, MODEL_NAMES, templateFromScenario, templateScenario, type ModelTemplate } from './modelTemplates'

type Props = { scenario: Scenario; templates: ModelTemplate[]; onApply: (s: Scenario) => void; onDirtyChange?: (dirty: boolean) => void; onSave: (templates: ModelTemplate[]) => Promise<void> | void }
const labels: Record<string, string> = {
  estimateTotal: '車両見積総額', inspectionCost: '車検費用', legalInspectionCost: '法定12か月点検', sixMonthInspectionCost: '6か月点検', tireCost: 'タイヤ代', annualTax: '年税額', monthlyInsurance: '月の任意保険', repairCost: '修理費', tireCycleYears: 'タイヤ周期（年）',
  cashMaintenanceYears: '維持期間（年）', creditMaintenanceYears: '維持期間（年）', bvcMaintenanceYears: '買取時の維持期間（年）', omatomeMaintenanceYears: '買取時の維持期間（年）',
  downPayment: '頭金', annualRate: '実質年率（%）', firstPayment: '初回支払額', monthlyPayment: '2回目以降月額', paymentCount: '支払回数', bonusPayment: 'ボーナス加算額', residualValue: '最終回（残価）', finalPayment: '最終回（買取）',
}
const groups = [
  ['newMaintenance', '維持費', ['inspectionCost','legalInspectionCost','sixMonthInspectionCost','tireCost','tireCycleYears','annualTax','monthlyInsurance','repairCost']],
  ['cash', '現金', ['cashMaintenanceYears']],
  ['credit', 'クレジット', ['creditMaintenanceYears','downPayment','annualRate','firstPayment','monthlyPayment','paymentCount','bonusPayment']],
  ['bvc', 'BVC', ['bvcMaintenanceYears','downPayment','annualRate','firstPayment','monthlyPayment','paymentCount','bonusPayment','residualValue']],
  ['omatome', 'おまとめプラン', ['omatomeMaintenanceYears','downPayment','firstPayment','monthlyPayment','paymentCount','bonusPayment','finalPayment']],
] as const

export function TemplatePanel({ scenario, templates, onApply, onSave, onDirtyChange }: Props) {
  const [editing, setEditing] = useState<ModelTemplate | null>(null)
  const [selected, setSelected] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [savedDraft, setSavedDraft] = useState('')
  useEffect(() => { onDirtyChange?.(!!editing && savedDraft !== JSON.stringify(editing)) }, [editing, savedDraft, onDirtyChange])
  const setDraft = (t: ModelTemplate | null) => { setEditing(t); setSavedDraft(JSON.stringify(t)); setError('') }
  const discard = () => !editing || savedDraft === JSON.stringify(editing) || window.confirm('概算設定の未保存の変更を破棄しますか？')
  const changeTerms = (section: string, key: string, value: unknown) => {
    if (!editing) return
    const s = templateScenario(editing)
    const next = { ...s, [section]: { ...s[section as keyof Scenario] as object, [key]: value } }
    setEditing(templateFromScenario(next, editing))
  }
  const commit = async () => {
    if (!editing || busy) return
    const t = { ...editing, updatedAt: new Date().toISOString() }
    if (!isModelTemplate(t)) { setError('設定名・車種、支払回数・維持期間を確認してください。金額は空欄のまま保存できます。'); return }
    setBusy(true)
    try { await onSave([...templates.filter(x => x.id !== t.id), t]); setDraft(null); setSelected(t.id) }
    catch (e) { setError(e instanceof Error ? e.message : '保存できませんでした。') }
    finally { setBusy(false) }
  }
  const apply = () => {
    const t = templates.find(x => x.id === selected)
    if (!t || !window.confirm(`「${t.name}」の概算条件で購入車・購入金額・維持費・4支払方法を置き換えますか？現在の顧客・現在車・下取りは保持します。未設定の方法は比較から外れます。`)) return
    onApply(applyTemplate(scenario, t))
  }
  return <section className="template-panel no-print" aria-label="車種別の概算プラン設定">
    <details onToggle={() => setError('')}>
      <summary>設定 · 車種別の概算プラン</summary>
      <p>登録額は概算です。金額は自分で入力し、未設定は空欄、費用なしは0円で登録してください。保存先はこの端末です。</p>
      <p className="field__hint">車名候補：日産公式乗用車ラインアップを {LINEUP_CHECKED_AT} 確認（商用モデル除外）。車名・グレードは自由に追加できます。<a href={LINEUP_SOURCE} target="_blank" rel="noreferrer">公式サイト</a></p>
      <div className="template-toolbar">
        <label>登録済み概算設定<select aria-label="登録済み概算設定" value={selected} onChange={e => setSelected(e.target.value)}><option value="">設定を選択</option>{templates.map(t => <option key={t.id} value={t.id}>{t.name} · {t.model} {t.grade} {t.drive}</option>)}</select></label>
        <button className="button button--primary" disabled={!selected || !!editing} onClick={apply}>比較へ読み込む</button>
        <button className="button button--quiet" disabled={!selected || busy} onClick={() => { if (discard()) setDraft(structuredClone(templates.find(t => t.id === selected)!)) }}>設定を編集</button>
        <button className="button button--quiet" disabled={busy} onClick={() => { if (discard()) setDraft(createTemplate()) }}>概算設定を追加</button>
      </div>
      {editing && <div className="template-editor">
        <h2>車種別の概算設定を編集</h2><p>顧客・下取り・現在の車の金額は保存しません。比較での手修正はこの設定へ自動反映されません。</p>
        <div className="form-grid">
          <TextField label="概算設定名" maxLength={120} value={editing.name} onValueChange={name => setEditing({ ...editing, name })} />
          <TextField label="車種名" list="nissan-models" maxLength={100} value={editing.model} onValueChange={model => setEditing({ ...editing, model })} />
          <datalist id="four-wheel-grades">{catalog.filter(r => r.model === editing.model).map(r => <option key={r.id} value={r.grade}>{r.drive} · {r.status}</option>)}</datalist>
          <datalist id="nissan-models">{MODEL_NAMES.map(m => <option key={m} value={m}/>)}</datalist>
          <TextField label="設定グレード" value={editing.grade} list="four-wheel-grades" maxLength={100} onValueChange={grade => setEditing({ ...editing, grade, drive: catalog.find(r=>r.model===editing.model&&r.grade===grade)?.drive || editing.drive })} />
          <SelectField label="設定駆動方式" value={editing.drive} onValueChange={drive => setEditing({ ...editing, drive })}><option value="4WD">4WD</option><option value="e-4ORCE">e-4ORCE（4WD）</option><option value="AWD">AWD</option></SelectField>
          <NumberField label="車両見積総額（概算）" value={editing.terms.vehicle.estimateTotal} onValueChange={v => changeTerms('vehicle','estimateTotal',v)} />
          <SelectField label="設定車両クラス" value={editing.terms.vehicle.vehicleClass} onValueChange={v => changeTerms('vehicle','vehicleClass',v)}>{[['kei','軽自動車'],['s','Sクラス'],['m','Mクラス'],['l','Lクラス']].map(([v,l]) => <option value={v} key={v}>{l}</option>)}</SelectField>
          <SelectField label="設定動力" value={editing.terms.vehicle.powertrain} onValueChange={v => changeTerms('vehicle','powertrain',v)}>{['gasoline','e-power','e-4orce','ev'].map(v => <option key={v}>{v}</option>)}</SelectField>
        </div>
        {groups.map(([section, title, keys]) => <fieldset key={section}><legend>{title}</legend>
          {section !== 'newMaintenance' && <label className="template-enable"><input type="checkbox" checked={editing.terms.comparison.enabledPlans[section]} onChange={e => setEditing({ ...editing, terms: { ...editing.terms, comparison: { enabledPlans: { ...editing.terms.comparison.enabledPlans, [section]: e.target.checked } } } })}/>この支払方法を登録・比較する（未設定はオフ）</label>}
          <div className="form-grid">{keys.map(key => {
            const value = (editing.terms[section] as unknown as Record<string, number | ''>)[key]
            return key === 'paymentCount' && (section === 'bvc' || section === 'omatome')
              ? <SelectField key={key} label={`${title} ${labels[key]}`} value={String(value)} onValueChange={v => changeTerms(section,key,Number(v))}>{(section === 'bvc' ? [36,48,60] : [36,60,84]).map(n => <option key={n} value={n}>{n}回</option>)}</SelectField>
              : <NumberField key={key} label={`${title} ${labels[key]}`} value={value} suffix={key.includes('Years') ? '年' : key === 'paymentCount' ? '回' : key === 'annualRate' ? '%' : '円'} step={key === 'annualRate' ? 0.01 : 1} onValueChange={v => changeTerms(section,key,v)} />
          })}</div>
          {section === 'newMaintenance' && <label><input type="checkbox" checked={editing.terms.newMaintenance.includeInsurance} onChange={e => changeTerms(section,'includeInsurance',e.target.checked)}/>任意保険を比較に含む</label>}
          {(section === 'bvc' || section === 'omatome') && <SelectField label={`${title} 期間終了時`} value={editing.terms[section].selectedMode} onValueChange={v => changeTerms(section,'selectedMode',v)}><option value="return">返却</option><option value="purchase">買取</option></SelectField>}
          {section === 'omatome' && <><p>支払期間内の車検・点検・タイヤ・税は料金込み。修理費は別途。期間超過分は別途計算します。</p><label><input type="checkbox" checked={editing.terms.omatome.included.insurance} onChange={e => changeTerms(section,'included',{ ...editing.terms.omatome.included, insurance: e.target.checked })}/>任意保険をおまとめ料金に含む</label></>}
        </fieldset>)}
        <p>クレジット・BVCは初回と月額の両方が空欄の場合のみ、入力した金利で計算します。月額を手入力する場合は初回も入力してください。</p>
        <button className="button button--primary" disabled={busy} onClick={() => void commit()}>概算設定を保存</button>{' '}
        <button className="button button--quiet" disabled={busy} onClick={() => { if (discard()) setDraft(null) }}>編集を閉じる</button>
      </div>}
      {error && <p role="alert">{error}</p>}
    </details>
  </section>
}
