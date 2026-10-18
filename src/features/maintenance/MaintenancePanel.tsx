import { useState } from 'react'
import catalog from './pitnote-pricing.json'
import type { Scenario } from '../../domain/types'
import { applyPricing, type PricingReference } from './pricing'
export function MaintenancePanel({ scenario, onChange, currentReference }: { scenario: Scenario; onChange:(s:Scenario)=>void; currentReference?:PricingReference }) {
  const [section,setSection] = useState<'currentCar'|'newMaintenance'|'usedMaintenance'>('newMaintenance')
  const [name,setName] = useState('')
  const [confirmed,setConfirmed] = useState(false)
  const ref = section==='currentCar' && currentReference ? currentReference : catalog.find(r=>r.model===name) as PricingReference|undefined
  const apply = () => {if(ref&&confirmed&&confirm('選択区分の6か月・12か月点検・車検整備料を置き換えますか？車検法定費用は空欄になります。'))onChange(applyPricing(scenario,section,ref))}
  return <section className="template-panel no-print"><details><summary>PITNOTE の点検・車検料金を使う</summary>
    <p>適用車種・型式と包含作業を確認して取り込みます。新型や特殊仕様に旧型の料金は流用しないでください。取込後の単価も「維持費」で手修正できます。</p>
    <div className="form-grid"><label>反映先<select aria-label="料金の反映先" value={section} onChange={e=>{setSection(e.target.value as typeof section);setConfirmed(false)}}><option value="newMaintenance">購入する新車</option><option value="currentCar">現在の車</option><option value="usedMaintenance">購入する中古車</option></select></label>
      {!(section==='currentCar'&&currentReference)&&<label>料金マスターの車種・型式<select aria-label="料金マスターの車種" value={name} onChange={e=>{setName(e.target.value);setConfirmed(false)}}><option value="">原表の適用車種を選択</option>{catalog.map((r,i)=><option key={i} value={r.model}>{r.model} · {r.codes}</option>)}</select></label>}
    </div>
    {ref && <>{!ref.available?<p role="status">{ref.reason}</p>:<><p>{ref.model} ／ 原表型式 {ref.codes} ／ 点検クラス {ref.inspectionClass} ／ {ref.masterVersion}</p><div className="pricing-reference-grid">{ref.results&&Object.entries(ref.results).map(([key,a])=><div key={key}><strong>{key==='six'?'6か月':key==='twelve'?'12か月':'車検整備料'}：{(key==='shaken'?a.subtotal:a.total)?.toLocaleString('ja-JP')??'未設定'}円</strong><ul>{a.items.map((item,i)=><li key={i}>{item.label} {item.amount.toLocaleString('ja-JP')}円</li>)}</ul>{a.reasons.map((reason,i)=><p key={i}>{reason}</p>)}</div>)}</div>
      <p>オイル・フィルターは上のパッケージ内で1回だけ計上します。車検整備料には法定費用（重量税・自賠責・印紙等）を含みません。更新手続料は整備小計に含まれています。</p>
      <label className="template-enable"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>この車種・型式への適用と、メンプロ等の別払い料金であることを確認しました</label>
      <button className="button button--primary" disabled={!confirmed} onClick={apply}>確認した単価を反映</button>
    </>}</>}
    <p>おまとめプランの期間内の込み項目は既存計算で差し引きます。メンプロ加入車は包含範囲が不明なため自動反映を止めます。新車の初回車検は3年、以後2年。現在車は登録済み次回車検月、未登録なら初度登録から回数を計算します。</p>
  </details></section>
}
