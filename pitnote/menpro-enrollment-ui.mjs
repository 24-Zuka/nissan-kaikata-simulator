import {menproProgress} from './menpro-progress.mjs';
import {MENPRO_CATALOG} from './menpro-catalog.mjs';
import {MENPRO_STATUSES,normalizeEnrollment} from './menpro-enrollment.mjs';
import {escapeHtml as esc} from './core.mjs';
export function enrollmentFields(vehicle){
 const e=normalizeEnrollment(vehicle?.menproEnrollment);
 const option=(value,label)=>`<option value="${esc(value)}" ${value===e.planId?'selected':''}>${esc(label)}</option>`;
 const legacy=e.planId&&e.planId!=='custom'&&!MENPRO_CATALOG.some(p=>p.id===e.planId);
 const archive=Array.isArray(vehicle?.menproEnrollmentArchive)?vehicle.menproEnrollmentArchive:[];
 return `<div id="bundledEnrollmentNotice" class="helper" ${vehicle?.bundledPlan==='あり'?'':'hidden'}>おまとめプランのためメンプロは対象外です。保存すると加入状況を「未加入」にします。元のプラン名・最終予定月は残し、加入中だった情報は切替前情報として保持します。${vehicle?.bundledPlan==='あり'&&e.status==='加入'?'<strong>既存の加入情報が重複しています。内容を確認して保存してください。</strong>':''}</div>${archive.length?`<details class="enrollment-archive"><summary>保持している切替前の加入情報（${archive.length}件）</summary>${archive.map(a=>`<p>${esc(a.enrollment?.planName||'プラン未確認')} · ${esc(a.enrollment?.status||'')} · 最終予定 ${esc(a.enrollment?.endMonth||'未登録')}</p>`).join('')}</details>`:''}<fieldset class="enrollment-fields" ${vehicle?.bundledPlan==='あり'?'disabled':''}><legend>メンプロの加入情報</legend><p class="helper">見積りのプラン選択とは別の登録です。契約書などで確認した情報を入力してください。加入車両では点検・メンプロの概算を表示しません。車検・タイヤの料金は表示します（おまとめプランありの場合は料金を非表示）。</p><div class="form-grid"><label>加入状況<select name="menproStatus">${MENPRO_STATUSES.map(s=>`<option ${s===e.status?'selected':''}>${s}</option>`).join('')}</select></label><label>加入プラン<select name="menproPlan">${option('','プラン不明・要確認')}${e.planId==='custom'?option('custom',`保持中：${e.planName||'旧プラン・要確認'}`):''}${legacy?option(e.planId,`保持中：${e.planName||'旧プラン・要確認'}`):''}${[...new Set(MENPRO_CATALOG.map(p=>p.group))].map(group=>`<optgroup label="${esc(group)}">${MENPRO_CATALOG.filter(p=>p.group===group).map(p=>option(p.id,p.label)).join('')}</optgroup>`).join('')}</select></label></div><label>メンプロ有効期限（年月・任意）<input name="menproEndMonth" value="${esc(e.endMonth||'')}" placeholder="例：2027/11" inputmode="numeric" maxlength="7"></label><p class="helper">このアプリの有効期限は「最終点検予定年月」です。会員証の利用猶予期限とは別です。</p><p class="helper">プラン不明のまま「加入」も登録できます。未確認・未加入に変更しても選択中のプラン情報は保持します。過去月の点検・車検予定は完了済みと仮定し、当月以降を残り予定として計算します。実際の入庫・連絡履歴は作成しません。</p></fieldset>`;
}

export function enrollmentTiming(vehicle,today){
 if(vehicle?.bundledPlan==='あり')return '';
 const e=normalizeEnrollment(vehicle?.menproEnrollment);if(e.status!=='加入')return '';
 const p=menproProgress(vehicle,today),date=month=>month.replace('-','/');
 if(p.status!=='calculated')return `<div class="enrollment-timing"><span>最終点検予定年月：${p.finalMonth?esc(date(p.finalMonth)):'未登録'}</span><small>${esc(p.reason)}</small></div>`;
 const last=p.scheduled.at(-1);
 return `<div class="enrollment-timing"><span>最終回予定：${esc(date(p.finalMonth))} · ${esc(last.label)}</span><strong>予定進捗 ${p.assumedCompleted}/${p.total}回完了と仮定 · 残り${p.remainingCount}回</strong><progress value="${p.assumedCompleted}" max="${p.total}" aria-label="点検・車検の予定進捗">${p.progressPercent}%</progress>${p.next?`<small>次の予定：${esc(date(p.next.month))} · ${esc(p.next.label)}</small>`:'<small>最終予定月を経過 · 全予定回を完了と仮定</small>'}<details class="menpro-remaining"><summary>残り予定を確認（${p.remainingCount}回）</summary>${p.remaining.length?`<ol>${p.remaining.map(s=>`<li>${esc(date(s.month))} · ${esc(s.label)}</li>`).join('')}</ol>`:'<p>当月以降の予定はありません。</p>'}</details><small>日産標準構成による予定です。過去月は完了と仮定、当月は残りに含みます。実績ではありません。新車無料点検・付帯作業は集計外です。</small></div>`;
}
