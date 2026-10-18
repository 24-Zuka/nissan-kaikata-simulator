import type { PricingReference } from '../features/maintenance/pricing'
import { MaintenancePanel } from '../features/maintenance/MaintenancePanel'
import { VehiclePresetPicker } from '../features/templates/VehiclePresetPicker'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { isValidScenario } from '../../server/scenarioSchema'
import type { CustomerLink, Scenario } from '../domain/types'
import { calculateComparison } from '../domain/comparison'
import { DetailInputScreen } from '../features/detail-input/DetailInputScreen'
import { CustomerPresentation } from '../features/customer-presentation/CustomerPresentation'
import { TemplatePanel } from '../features/templates/TemplatePanel'
import { isModelTemplate, newLinkedScenario, type ModelTemplate } from '../features/templates/modelTemplates'
import '../app/global.css'
import '../app/App.css'
import '../app/print.css'
import '../app/pitnote.css'

type Record = { id: string; createdAt: string; updatedAt: string; scenario: Scenario }
type Init = { currentReference?: PricingReference; nonce: string; context: CustomerLink; records: Record[]; templates: ModelTemplate[] }
type Reply = { type: string; nonce: string; requestId: string; record?: Record; templates?: ModelTemplate[]; message?: string }
export function IntegratedApp({ init }: { init: Init }) {
  const [scenario, setScenario] = useState(() => newLinkedScenario(init.context))
  const [records, setRecords] = useState(init.records)
  const [templates, setTemplates] = useState(init.templates)
  const [id, setId] = useState('')
  const [snapshot, setSnapshot] = useState(() => JSON.stringify(newLinkedScenario(init.context)))
  const [mode, setMode] = useState<'input' | 'presentation'>('input')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [templateDirty, setTemplateDirty] = useState(false)
  const pending = useRef(new Map<string, { resolve: (r: Reply) => void; reject: (e: Error) => void }>())
  const result = useMemo(() => calculateComparison(scenario), [scenario])
  const dirty = JSON.stringify(scenario) !== snapshot
  const post = (m: object) => window.parent.postMessage({ ...m, nonce: init.nonce }, location.origin)
  useEffect(() => {
    window.parent.postMessage({ type: 'carplan:dirty', nonce: init.nonce, dirty: dirty || templateDirty }, location.origin)
    const leave = (e: BeforeUnloadEvent) => { if (dirty || templateDirty) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', leave)
    return () => window.removeEventListener('beforeunload', leave)
  }, [dirty, templateDirty, init.nonce])
  useEffect(() => {
    const receive = (event: MessageEvent<Reply>) => {
      if (event.origin !== location.origin || event.source !== window.parent || event.data?.nonce !== init.nonce) return
      const m = event.data, p = pending.current.get(m.requestId)
      if (!p) return
      if (m.type === 'pitnote:error') p.reject(new Error(m.message))
      else if (m.type === 'pitnote:saved') p.resolve(m)
      else return
      pending.current.delete(m.requestId)
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [init.nonce])
  const request = (message: object): Promise<Reply> => new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID()
    const timer = window.setTimeout(() => { pending.current.delete(requestId); reject(new Error('保存確認が届きません。画面を閉じず保存状態を確認してください。')) }, 15000)
    pending.current.set(requestId, { resolve: r => { clearTimeout(timer); resolve(r) }, reject: e => { clearTimeout(timer); reject(e) } })
    post({ ...message, requestId })
  })
  const save = async () => {
    if (!isValidScenario(scenario)) { setMessage('入力の形式・回数・期間を確認してください。'); return }
    setBusy(true)
    const old = records.find(r => r.id === id), now = new Date().toISOString()
    const record = { id: id || crypto.randomUUID(), createdAt: old?.createdAt || now, updatedAt: now, scenario: structuredClone(scenario) }
    try {
      const reply = await request({ type: 'carplan:save', record })
      if (!reply.record) throw new Error('保存結果を確認できません。')
      setRecords([reply.record, ...records.filter(r => r.id !== reply.record!.id)])
      setId(reply.record.id); setScenario(reply.record.scenario); setSnapshot(JSON.stringify(reply.record.scenario))
      setMessage('顧客と車両に紐づけて端末に保存しました。PITNOTE の暗号化バックアップにも含まれます。')
    } catch (e) { setMessage((e as Error).message) } finally { setBusy(false) }
  }
  const load = (nextId: string) => {
    if (dirty && !confirm('未保存の比較を破棄して切り替えますか？')) return
    const next = nextId ? records.find(r => r.id === nextId)?.scenario : newLinkedScenario(init.context)
    if (!next) return
    setScenario(structuredClone(next)); setSnapshot(JSON.stringify(next)); setId(nextId); setMode('input');setMessage('')
  }
  const changeMode = (next: 'input' | 'presentation') => {
    if (templateDirty && !confirm('編集中の概算設定を破棄して画面を切り替えますか？')) return
    setTemplateDirty(false); setMode(next)
  }
  const print = () => {
    if (result.incompletePlans.length || result.completePlans.length < 2) { setMessage('印刷するには完成した2プラン以上が必要です。未完成プランを入力するか比較対象から外してください。');setMode('input');return }
    if (templateDirty && !confirm('編集中の概算設定を破棄して印刷へ進みますか？')) return
    setTemplateDirty(false); setMode('presentation');window.setTimeout(() => window.print(), 100)
  }
  return <div className="app-shell integrated-app">
    <header className="app-header">
      <div className="brand"><span className="pitnote-mark">P</span><div><strong>CarPlan</strong><span>PIT NOTE · 購入・維持費比較</span></div></div>
      <div className="integrated-actions">
        <button className="button button--quiet" disabled={busy} onClick={() => changeMode(mode === 'input' ? 'presentation' : 'input')}>{mode === 'input' ? 'お客様説明' : '入力へ戻る'}</button>
        <button className="button button--quiet" disabled={busy} onClick={print}>印刷</button>
        <button className="button button--primary" disabled={busy} onClick={() => void save()}>{busy ? '保存中…' : '比較を保存'}</button>
        <button className="button button--quiet" disabled={busy} onClick={() => post({ type: 'carplan:close' })}>PITNOTEへ戻る</button>
      </div>
    </header>
    <fieldset className="integrated-body" disabled={busy}>
    {mode === 'input' && <>
      <section className="customer-context no-print"><strong>{init.context.customerName} 様 · {init.context.vehicleName} · ナンバー {init.context.numberLast4 || '未登録'}</strong><p>現在の車から比較を作成します。購入する新車は下の車種設定または手入力で選択してください。担当者：西塚</p></section>
      <section className="scenario-bar"><label>この顧客・車両の保存済み比較<select aria-label="この顧客・車両の保存済み比較" disabled={busy} value={id} onChange={e => load(e.target.value)}><option value="">新規比較</option>{records.map(r => <option key={r.id} value={r.id}>{r.scenario.quote.scenarioName} · {r.createdAt.slice(0,10)}</option>)}</select></label></section>
      {id && <p className="snapshot-note">保存時の氏名・車両情報と試算条件を表示しています。元の顧客情報や概算設定を編集しても更新されません。</p>}
      <MaintenancePanel scenario={scenario} onChange={setScenario} currentReference={init.currentReference}/><VehiclePresetPicker key={`${scenario.quote.carName}:${scenario.quote.grade}:${scenario.quote.drive}`} scenario={scenario} templates={templates} onChange={setScenario}/><TemplatePanel scenario={scenario} templates={templates} onDirtyChange={setTemplateDirty} onApply={setScenario} onSave={async next => { setBusy(true); try { const reply = await request({ type: 'carplan:templates', templates: next }); setTemplates(reply.templates || next) } finally { setBusy(false) } }}/>
    </>}
    {message && <div className="notice no-print" role="status">{message}</div>}
    {mode === 'input' ? <DetailInputScreen key={id} scenario={scenario} result={result} onChange={setScenario}/> : <CustomerPresentation scenario={scenario} result={result} onEdit={() => setMode('input')}/>}
    </fieldset>
  </div>
}
const root = createRoot(document.getElementById('root')!)
root.render(<p role="status">PITNOTE の顧客詳細から CarPlan を開いてください。</p>)
if (window.parent !== window) {
  const initialize = (e: MessageEvent) => {
    const d = e.data
    if (e.source !== window.parent || e.origin !== location.origin || d?.type !== 'pitnote:init' || typeof d.nonce !== 'string') return
    if (!d.context?.customerId || !d.context?.vehicleId || !Array.isArray(d.records) || !Array.isArray(d.templates)
      || !d.records.every((r: Record) => isValidScenario(r.scenario) && r.scenario.customerLink?.customerId === d.context.customerId && r.scenario.customerLink?.vehicleId === d.context.vehicleId)
      || !d.templates.every(isModelTemplate)) {
      root.render(<p role="alert">保存データの形式を確認できません。元データは変更していません。</p>); return
    }
    window.removeEventListener('message', initialize)
    root.render(<IntegratedApp init={d}/>)
  }
  window.addEventListener('message', initialize)
  window.parent.postMessage({ type: 'carplan:ready' }, location.origin)
}
