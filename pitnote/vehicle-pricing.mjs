import {normalizeEnrollment} from './menpro-enrollment.mjs';
import {PRICE_DATA} from './price-data.mjs';
import {commercialProfile,COMMERCIAL_KEYS,COMMERCIAL_USE,COMMERCIAL_MODELS} from './commercial.mjs';
import {VEHICLE_MASTER} from './vehicle-master.mjs';
import {shiftRegistration,inspectionKindFromExpiry} from './schedule.mjs';
import {defaultEstimate,estimateAssessment,ESTIMATE_CLASSES,MENPRO_GROUPS,PLANS} from './estimate.mjs';
import {escapeHtml as esc} from './core.mjs';
export const VEHICLE_CLASSES=['軽自動車','SS','S','M','L','LL','LLL','GT-R','その他・個別確認'];
// Legacy size-only mapping stays disabled. Current registration uses source-backed model profiles.
export const STANDARD_MAPPING_APPROVED=false;
export function unifiedProfile(vehicleClass='その他・個別確認',productType='乗用車'){return {...pricingProfile(null),vehicleClass,productType};}
export {VEHICLE_MASTER};
export function modelProfile(model,maker='日産',conditions={}){
 const name=String(model||'').replace(/^デモ\s*/,'').trim(),m=maker==='日産'?VEHICLE_MASTER.find(x=>x.name===name):null;
 if(!m)return {...pricingProfile(null),manufacturer:maker,masterId:'',vehicleClass:'その他・個別確認',mappingNote:maker==='日産'?(VEHICLE_MASTER.length?'車種未選択：料金は個別確認':'標準料金を読み込めません。再読み込みしてください'):'他メーカー：日産の料金を流用しません'};
 return commercialProfile({...pricingProfile(null),...m,manufacturer:'日産',masterId:m.id,vehicleClass:m.inspectionClass==='軽'?'軽自動車':m.inspectionClass==='未確認'?'その他・個別確認':m.inspectionClass,vehicleVariant:m.commercial?'商用・事業用（料金要確認）':m.productType==='EV'?'EV（自家用乗用）':'標準ガソリン・HV（自家用乗用）',mappingNote:m.reasons.join('。')},conditions);
}
export const VARIANTS=['未確認','標準ガソリン・HV（自家用乗用）','EV（自家用乗用）','特殊仕様・型式を個別確認','商用・事業用（料金要確認）'];
export const MODEL_NAMES=['サクラ','デイズ','デイズルークス','ルークス','モコ','オッティ','マーチ','キューブ','ノート','オーラ','キックス','リーフ','シルフィ','プリメーラ','セレナ','エクストレイル','アリア','スカイライン','フーガ','エルグランド','フェアレディZ','GT-R','クリッパー','NV200','キャラバン','アトラス'];
export const PROFILE_KEYS=['inspectionClass','oilClass','tireClass','menproClass','menproGroup','membership','oilEligibility','eligibility'];
export function pricingProfile(v){
 const d=defaultEstimate(),saved=v?.pricing||{},base={vehicleClass:'その他・個別確認',productType:'乗用車',vehicleVariant:'未確認',inspectionService:'未確認',...Object.fromEntries(PROFILE_KEYS.map(k=>[k,d[k]])),...saved};
 // Only a unique, exact Nissan model with no previously assigned classes is supplemented.
 // This is a display draft; never modify stored vehicle/customer data while rendering.
 const name=typeof v?.model==='string'?v.model.trim():'',maker=saved.manufacturer||'日産';
 const matches=maker==='日産'&&name?VEHICLE_MASTER.filter(m=>m.name===name):[];
 const unset=['inspectionClass','oilClass','tireClass','menproClass'].every(k=>saved[k]===undefined||saved[k]===''||saved[k]==='未確認');
 if(matches.length!==1||saved.masterId||!unset||saved.vehicleVariant==='特殊仕様・型式を個別確認')return base;
 const mapped=modelProfile(name,maker,saved);
 const defaults={vehicleClass:'その他・個別確認',productType:'乗用車',vehicleVariant:'未確認',menproGroup:'未確認'};
 if(Object.entries(defaults).some(([k,fallback])=>saved[k]&&saved[k]!==fallback&&saved[k]!==mapped[k]))return base;
 return {...base,...mapped,...Object.fromEntries(['membership','oilEligibility','eligibility','inspectionService'].filter(k=>Object.hasOwn(saved,k)).map(k=>[k,saved[k]]))};
}
const keyOf=model=>String(model||'').replace(/^デモ\s*/,'').trim();
export function vehicleMapping(model,variant){return {profile:modelProfile(model),note:'アプリ内の標準料金マスターの対応だけを使用します。'};}
export function validatePricing(p){
 const result={...pricingProfile(null),...p};
 if(!VARIANTS.includes(result.vehicleVariant)||!['未確認','one','three','six','twelve'].includes(result.inspectionService))throw Error('車種条件・入力点検の種類を確認してください');
 for(const k of ['inspection','oil','tire','menpro'])if(!ESTIMATE_CLASSES[k].includes(result[k+'Class']))throw Error('作業ごとの料金クラスを確認してください');
 if(!MENPRO_GROUPS.includes(result.menproGroup))throw Error('メンプロの商品区分を確認してください');
 return result;
}
export function noticeKey(n){return n.type+'|'+n.due;}
export function noticeService(v,n){const expiry=n.type==='inspection'&&v.inspection===n.due?inspectionKindFromExpiry(v,n.due):null;if(expiry)return expiry==='shaken'?'未確認':expiry;return n.type==='shaken'?'shaken':n.label==='6か月点検'?'six':n.label==='12か月点検'?'twelve':v.estimates?.[noticeKey(n)]?.service||pricingProfile(v).inspectionService;}
// Apply exclusions to a derived draft only; retained quotes and enrollment data are untouched.
export function applicableQuote(v,d){
 if(v?.bundledPlan!=='あり')return d;
 return {...d,coverage:'未加入',membership:['メンプロ（ライト以外）','メンプロライト'].includes(d.membership)?'未確認':d.membership,...(d.service==='tires'&&d.priceMethod==='会員'?{priceMethod:'未確認'}:{})};
}
export function quoteFor(v,n=null,service=null){return applicableQuote(v,rawQuoteFor(v,n,service));}
function rawQuoteFor(v,n=null,service=null){
 const chosen=n?noticeService(v,n):(service||v.quoteLastService||'six'),key=n?noticeKey(n):'reference|'+chosen;
 const saved=v.estimates?.[key]||{},draft=saved.service===chosen?saved:{};
 const cp=pricingProfile(v),standard=!!cp.masterId||cp.vehicleClass&&!['GT-R','その他・個別確認'].includes(cp.vehicleClass),ev=cp.productType==='EV',oilKnown=cp.oilClass!=='未確認';
 const defaults=standard?{referenceOnly:true,oil:ev||cp.commercial&&!oilKnown?'なし':'あり',element:ev||cp.commercial&&!oilKnown?'なし':'あり',...(cp.commercial?{diagnosisSix:'あり',severe:cp.commercialBand==='軽商用'?'あり':'なし',withShaken:cp.menproGroup==='商用'?'あり':'未確認'}:{}),priceMethod:chosen==='tires'?'通常':'標準',tireWork:chosen==='tires'?'ホイール付き履き替え':'未確認',tpms:chosen==='tires'?'なし':'未確認',coverage:'未加入'}:{};
 return {...defaultEstimate(),...defaults,...draft,...Object.fromEntries(PROFILE_KEYS.map(k=>[k,pricingProfile(v)[k]])),...Object.fromEntries(COMMERCIAL_KEYS.map(k=>[k,cp[k]])),vehicleVariant:cp.vehicleVariant,service:chosen};
}
export function storeQuote(v,context,values){
 const old=rawQuoteFor(v,context?.notice,context?.service),service=values.service||old.service;
 if(v.bundledPlan==='あり'){
  if(service==='menpro')throw Error('おまとめプランありのため、メンプロは対象外です。保存済みの見積りは保持しています。');
  values={...values};
  // Hidden or display-normalized controls must not overwrite retained legacy conditions.
  delete values.coverage;
  if(['メンプロ（ライト以外）','メンプロライト'].includes(old.membership)&&values.membership==='未確認')delete values.membership;
  if(service==='tires'&&old.priceMethod==='会員'&&values.priceMethod==='未確認')delete values.priceMethod;
 }
 if(context?.notice){const expiry=context.notice.type==='inspection'&&v.inspection===context.notice.due?inspectionKindFromExpiry(v,context.notice.due):null,locked=expiry?(expiry==='shaken'?'未確認':expiry):context.notice.type==='shaken'?'shaken':context.notice.label==='6か月点検'?'six':context.notice.label==='12か月点検'?'twelve':null;if(locked&&service!==locked)throw Error('この用件の作業は変更できません');if(!locked&&!['未確認','one','three','six','twelve'].includes(service))throw Error('点検の種類を選択してください');}
 const next={...old,...values,service};
 v.pricing=validatePricing({...pricingProfile(v),...Object.fromEntries(PROFILE_KEYS.filter(k=>k in values).map(k=>[k,values[k]]))});
 const key=context?.notice?noticeKey(context.notice):'reference|'+service;
 v.estimates||={};v.estimates[key]=Object.fromEntries(Object.entries(next).filter(([k])=>!PROFILE_KEYS.includes(k)));
 if(!context?.notice)v.quoteLastService=service;
 return next;
}
export function assessVehicleQuote(v,n=null,service=null){const d=quoteFor(v,n,service);if(v.bundledPlan==='あり'&&d.service==='menpro')return {status:'メンプロ対象外',subtotal:null,total:null,reasons:['おまとめプランありのため、メンプロは対象外です。保存済みの見積りは保持しています。'],items:[],notes:[]};if(d.service==='未確認')return {status:'点検種別を確認',subtotal:null,total:null,reasons:['この点検の種類を選択してください。'],items:[],notes:[]};return estimateAssessment(d);}
export function saveVehicleProfile(old,model,p){const changed=!!old&&(pricingProfile(old).vehicleClass!==p.vehicleClass||pricingProfile(old).productType!==p.productType||pricingProfile(old).vehicleVariant!==p.vehicleVariant||pricingProfile(old).masterId!==p.masterId||['commercialUse','commercialBand','commercialFuel'].some(k=>pricingProfile(old)[k]!==p[k]));const estimates=changed?{}:structuredClone(old?.estimates||{});if(old&&pricingProfile(old).inspectionService!==p.inspectionService&&old.inspection)delete estimates['inspection|'+old.inspection];return {pricing:validatePricing(changed?{...p,membership:'未確認',oilEligibility:'未確認',eligibility:'未確認'}:p),estimates,quoteLastService:changed?'six':old?.quoteLastService||'six'};}
const select=(label,name,values,value)=>`<label>${label}<select name="${name}">${values.map(x=>{const [k,l]=Array.isArray(x)?x:[x,x];return `<option value="${esc(k)}" ${value===k?'selected':''}>${esc(l)}</option>`;}).join('')}</select></label>`;
export function vehiclePricingFields(v){const p=pricingProfile(v),maker=p.manufacturer||'日産',name=v?.model||'',m=modelProfile(name,maker,p);return `<div class="vehicle-pricing-fields" id="vehiclePricingFields"><div class="form-grid">${select('メーカー','manufacturer',['日産','その他'],maker)}${maker==='日産'&&VEHICLE_MASTER.length?`<label>車種を検索<input id="modelSearch" type="search" placeholder="例：ノート・セレナ" autocomplete="off" aria-controls="vehicleModelSelect"><button id="modelSearchClear" type="button" class="text-button">検索をクリア</button><small id="modelSearchStatus" aria-live="polite"></small></label>`+select('車種を選択','model',[['','車種を選んでください'],...VEHICLE_MASTER.map(m=>[m.name,m.name]),...name&&!VEHICLE_MASTER.some(m=>m.name===name)?[[name,name]]:[]],name).replace('<select name="model"','<select id="vehicleModelSelect" name="model"'):`<label>車種名<input name="model" value="${esc(name)}" placeholder="車種名を入力" maxlength="100"></label>`}</div>${m.commercialSupported?`<div class="form-grid">${select('貨物の用途','commercialUse',COMMERCIAL_USE,m.commercialUse)}${COMMERCIAL_MODELS[m.masterId]?.bandSelectable?select('原表の適用欄','commercialBand',['未確認',['Sバン','Sバン（原表1500cc欄）'],['Mバン','Mバン（原表1500〜2000cc欄）']],m.commercialBand):''}${COMMERCIAL_MODELS[m.masterId]?.fuelSelectable?select('エンジン（油の料金に使用）','commercialFuel',['未確認',['gas','ガソリン'],['diesel','ディーゼル']],m.commercialFuel):''}</div><p class="helper">商用車は予定の自動計算対象外です。詳細欄に実際の点検日・車検満了日を入力してください。</p>`:''}<div class="model-mapping" id="mappingNote">${mappingSummary(m)}</div><input type="hidden" name="vehicleClass" value="${esc(m.vehicleClass)}"><input type="hidden" name="productType" value="${esc(m.productType)}"></div>`;}
export function mappingSummary(p){return p.masterId?`<p class="helper">点検・車検 ${esc(p.inspectionClass)} ／ オイル ${p.productType==='EV'?'対象外（EV）':esc(p.oilClass)} ／ タイヤ ${esc(p.tireClass)} ／ メンプロ ${esc(p.menproClass)}<br>商品：${esc(p.productType)}${!['乗用','EV'].includes(p.menproGroup)?' / メンプロは'+esc(p.menproGroup)+'専用':''}${p.codes?' · 型式 '+esc(p.codes):''}</p>${p.mappingNote?`<p class="helper">${esc(p.mappingNote)}</p>`:''}`:`<p class="helper">${esc(p.mappingNote)}</p>`;}
export function menproOptions(v){
 if(v.bundledPlan==='あり')return [];
 const d=quoteFor(v,null,'menpro'),out=[];
 for(const period of ['6','12','18','24','30','42','54'])for(const plan of PLANS.slice(1))for(const withShaken of ['なし','あり']){
  const r=PRICE_DATA.menproRows[[d.menproGroup,period,d.menproClass].join('|')],pi=PLANS.indexOf(plan)-1,cell=r?'IJKLMNOP'[pi*2+(withShaken==='あり'?0:1)]+r:'';
  if(typeof PRICE_DATA.menpro.cells[cell]!=='number')continue;
  const result=estimateAssessment({...d,period,plan,withShaken});
  out.push({value:[plan,period,withShaken].join('|'),period,plan,withShaken,subtotal:result.subtotal,cell,label:`メンプロ${period} · ${d.menproGroup==='乗用'?'乗用車':d.menproGroup} / ${plan} / 車検${withShaken==='あり'?'付き':'なし'}`});
 }
 return out;
}
export function hideEnrollmentQuote(v,service){return normalizeEnrollment(v?.menproEnrollment).status==='加入'&&['one','three','six','twelve','menpro'].includes(service);}
export function menproReference(v,section='all'){if(hideEnrollmentQuote(v,'menpro')){if(section==='menpro')return '';section='tires';}if(v.bundledPlan==='あり')return '';if(PRICE_DATA.available===false)return section==='tires'?'': '<div class="vehicle-reference"><strong>メンプロ見積り · 整備費とは別枠</strong><p class="helper">標準料金を読み込めません。再読み込みしてください。加入情報は車両ごとの登録内容です。</p></div>'; 
 const d=quoteFor(v,null,'menpro'),m=assessVehicleQuote(v,null,'menpro'),t=assessVehicleQuote(v,null,'tires'),options=menproOptions(v),selected=[d.plan,d.period,d.withShaken].join('|'),chosen=d.plan!=='未確認'||d.period!=='未確認';
 const price=n=>n===null?'未確定':n.toLocaleString('ja-JP')+'円（税込）';
 const title=chosen?`メンプロ${d.period==='未確認'?'（期間未確認）':d.period} · ${d.menproGroup==='乗用'?'乗用車':d.menproGroup} / ${d.plan} / 車検${d.withShaken==='あり'?'付き':d.withShaken==='なし'?'なし':'有無未確認'}`:'プラン未選択・価格未確定';
 const examples=[options.find(o=>o.period==='6'&&o.plan==='ベーシック'&&o.withShaken===(d.menproGroup==='商用'?'あり':'なし')),options.find(o=>o.period==='18'&&o.plan==='ベーシック'&&o.withShaken==='あり')].filter(Boolean);
 return `<div class="vehicle-reference"><small>${section==='tires'?'タイヤの参考額（整備費とは別）':esc(v.model)+' · 整備費とは別の参考'}</small>${section!=='tires'?`<div class="menpro-choice"><strong>メンプロ見積り · 加入情報とは別</strong><p class="menpro-selected">${esc(title)}${chosen?' — '+price(m.subtotal):''}</p><label>掲載プランを比較<select data-menpro-choice="${esc(v.id)}"><option value="">プランを選択（契約の登録ではありません）</option>${chosen&&!options.some(o=>o.value===selected)?`<option selected value="${esc(selected)}">${esc(title)} — 未確定（原表空欄・条件未確認）</option>`:''}${options.map(o=>`<option value="${esc(o.value)}" ${o.value===selected?'selected':''}>${esc(o.label)} — ${price(o.subtotal)}</option>`).join('')}</select></label>${!chosen?`<div class="menpro-examples"><small>掲載例 · 加入や契約を示しません</small>${examples.length?examples.map(o=>`<p>${esc(o.label)}<strong>${price(o.subtotal)}</strong></p>`).join(''):'<p>車種・用途の条件が未確定です。</p>'}</div>`:''}<button class="text-button" data-menpro-open="${esc(v.id)}">${m.subtotal===null?'プラン・条件を見る':price(m.subtotal)+' · 条件を見る'}</button></div>`:''}${section!=='menpro'?`<div class="reference-values"><div><span>タイヤ履替4本</span><button class="text-button" data-tire-open="${esc(v.id)}">${t.subtotal===null?'要確認':price(t.subtotal)}</button></div></div><small>タイヤ初期条件：センサー登録なし</small>`:''}</div>`;
}
export function quoteBreakdown(v,n){
 const d=quoteFor(v,n),r=assessVehicleQuote(v,n);if(r.subtotal===null)return null;
 const oils=r.items.filter(i=>i.label.startsWith('オイル')),maintenance=r.items.filter(i=>!i.label.startsWith('オイル')).reduce((a,i)=>a+i.amount,0);
 return {inspection:maintenance,oil:oils.length?oils.reduce((a,i)=>a+i.amount,0):null,oilLabel:d.service==='twelve'&&d.element==='あり'?'オイル・エレメント交換（セット）':'オイル交換',total:r.subtotal};
}
export function listQuote(v,n){if(n.type==='inspection'&&hideEnrollmentQuote(v,'six'))return '';if(v.bundledPlan==='あり')return '<p class="helper bundled-plan-note">おまとめプラン · 料金表示なし</p>'; 
 if(PRICE_DATA.available===false)return '<div class="target-quote quote-unavailable"><strong>概算費用：標準料金を読み込めません</strong><p>アプリを再読み込みしてください。顧客情報は変更しません。</p></div>';
 const r=assessVehicleQuote(v,n),d=quoteFor(v,n),parts=quoteBreakdown(v,n),label=({six:'6か月点検',twelve:'12か月点検',three:'3か月点検',one:'1か月点検',shaken:'車検整備小計'})[d.service]||'点検種別を確認';
 const price=x=>x.toLocaleString('ja-JP')+'円';
 const action=`data-quote-open="${esc(v.id)}" data-quote-type="${esc(n.type)}" data-quote-due="${esc(n.due)}"`;
 const missingProfile=!v.pricing?.masterId&&['未確認','GT-R・その他（個別確認）'].includes(pricingProfile(v).inspectionClass);
 const unavailable=r.subtotal===null?`<div class="quote-unavailable"><p>${missingProfile?'車種の料金区分が未設定・未対応です。車種を確認して保存してください。':''}</p><ul>${r.reasons.map(reason=>`<li>${esc(reason)}</li>`).join('')}</ul>${missingProfile?`<button type="button" class="secondary" data-edit-vehicle="${esc(v.id)}">車種・料金区分を確認</button>`:''}</div>`:'';
 const formula=d.service!=='shaken'&&parts?`<div class="quote-equation"><span class="quote-term"><span>${label}</span><strong>${price(parts.inspection)}</strong></span>${parts.oil!==null?`<b class="quote-plus" aria-label="プラス">＋</b><span class="quote-term"><span>${parts.oilLabel}</span><strong>${price(parts.oil)}</strong></span>`:''}</div>`:`<span>${label}</span>`;
 return `<div class="target-quote" data-quote-vehicle="${esc(v.id)}" data-quote-key="${esc(noticeKey(n))}"><div>${formula}<button class="quote-amount" ${action}>${r.subtotal===null?'要確認・合計未確定':(d.service==='shaken'?'':'＝ 合計 ')+price(r.subtotal)+'（税込）'}</button><small>${d.service==='shaken'?'法定費用・諸費用・追加整備は別':d.commercial&&d.oilClass==='未確認'?'油代は未確定のため含めていません':'標準単品の参考額。加入済み作業は別途確認'}</small>${unavailable}</div><button type="button" class="secondary quote-detail" ${action}>費用の詳細</button></div>`;
}


export function modelSearchKey(value){return String(value??'').normalize('NFKC').toLowerCase().replace(/[ぁ-ゖ]/g,c=>String.fromCharCode(c.charCodeAt(0)+0x60)).replace(/\s/g,'');}
export function filterModelOptions(options,query,selected){const q=modelSearchKey(query),matches=options.filter(([value,label])=>value&&modelSearchKey(label).includes(q));return {count:matches.length,options:options.filter(([value,label])=>!value||value===selected||modelSearchKey(label).includes(q))};}
