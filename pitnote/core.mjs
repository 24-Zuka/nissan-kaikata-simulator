import {normalizeOutlook} from './vehicle-outlook.mjs';
import {normalizeEnrollment} from './menpro-enrollment.mjs';
import {numberValue,validateNumber} from './vehicle-number.mjs';
import {vehicleNotices,SCHEDULE_MODES,inspectionKindFromExpiry,outsideCurrentInspectionCycle} from './schedule.mjs';
export {vehicleNotices,SCHEDULE_MODES,outsideCurrentInspectionCycle};
import {japanToday,adoptionMonth} from './clock.mjs';
export let TODAY=japanToday();
export function refreshToday(){TODAY=japanToday();return TODAY;}
export const TYPES={inspection:'点検',shaken:'車検'};
export const STATUSES=['不在','折返し','検討中','今回は見送り','予約済','連絡済','入庫済','未連絡'];
export const statusLabel=s=>({'折返し':'折り返し待ち（日程調整中）','予約済':'入庫予約済み','連絡済':'連絡済み（旧記録・その他）','入庫済':'入庫済み'}[s]||s);
export const STATUS_OPTIONS=['不在','折返し','検討中','今回は見送り','予約済','入庫済'].map(s=>[s,statusLabel(s)]);
export const INSURANCES=['未確認','自社','他社'];
export const JAF_OPTIONS=['未確認','有','無'];
export const PREFS=['不明','電話','SMS','メール','連絡不要'];
export function activeCustomers(data){return data.customers.filter(c=>!c.deletedAt);}
export function trashCustomers(data){return data.customers.filter(c=>c.deletedAt);}
export function trashCustomer(data,id){const c=data.customers.find(c=>c.id===id);if(!c)throw Error('顧客が見つかりません');if(c.deletedAt)return false;c.deletedAt=TODAY;return true;}
export function restoreCustomer(data,id){const c=data.customers.find(c=>c.id===id);if(!c)throw Error('顧客が見つかりません');if(!c.deletedAt)return false;delete c.deletedAt;return true;}
export function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function validDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T00:00:00Z');return Number.isFinite(+d)&&d.toISOString().slice(0,10)===s&&s>='1900-01-01'&&s<='2199-12-31';}
export function normalizeDateInput(value,{allowMonth=false}={}){
 if(typeof value!=='string')throw Error('日付は文字列で入力してください');
 const s=value.trim();if(!s)return '';
 const m=/^(\d{4})([-/])(\d{1,2})(?:\2(\d{1,2}))?$/.exec(s);
 if(!m||!allowMonth&&!m[4])throw Error('正しい年月日を入力してください（例：2024/10/10）');
 const result=m[1]+'-'+m[3].padStart(2,'0')+(m[4]?'-'+m[4].padStart(2,'0'):'');
 if(!validDate(result+(m[4]?'':'-01')))throw Error('存在する日付を入力してください');
 return result;
}
export const BUNDLED_PLANS=['未確認','なし','あり'];
export function validRegistrationDate(s){return typeof s==='string'&&(validDate(s)||/^\d{4}-\d{2}$/.test(s)&&validDate(s+'-01'));}
export function registrationDateLabel(s){return s?s.replaceAll('-','/')+(s.length===7?'（年月のみ）':''):'未入力';}
export function days(a,b){return Math.round((new Date(a+'T00:00:00Z')-new Date(b+'T00:00:00Z'))/86400000);}
export function monthRange(today,offset=0){if(!validDate(today))throw Error('基準日が不正です');const [y,m]=today.split('-').map(Number);const start=new Date(Date.UTC(y,m-1+offset,1)),end=new Date(Date.UTC(y,m+offset,0));return [start.toISOString().slice(0,10),end.toISOString().slice(0,10)];}
export function noticeStart(due,type){if(!validDate(due)||!TYPES[type])throw Error('対象日付・案内種類が不正です');return monthRange(due,type==='inspection'?-1:-3)[0];}
export function seed(){return {customers:[],vehicles:[],history:[]};}
export function needsRecordReview(data){return data.customers.some(c=>!c.deletedAt&&/^c[1-6]$/.test(c.id)&&/^デモ /.test(c.name));}
// Resolve only one unambiguous automatic inspection in the same car and month.
// Original records/dates/labels remain untouched; entered dates and different months never merge.
export function currentCaseNotice(data,n){
 const v=data.vehicles?.find(v=>v.id===n.vehicleId&&v.customerId===n.customerId);
 if(!v||n.type!=='inspection'||v.inspection||!validRegistrationDate(n.due))return n;
 const kind=inspectionKindFromExpiry(v,n.due);if(!['six','twelve'].includes(kind))return n;
 const month=n.due.slice(0,7),scheduled=vehicleNotices(v,n.due).find(e=>e.type==='inspection'&&e.source==='calculated'&&e.due.slice(0,7)===month);if(!scheduled)return n;
 const history=data.history.filter(h=>h.customerId===v.customerId&&h.vehicleId===v.id&&h.type==='inspection'&&h.due?.slice(0,7)===month);
 if(history.some(h=>h.source!=='calculated'||!validRegistrationDate(h.due)))return n;
 const days=[...new Set(history.filter(h=>h.due.length===10).map(h=>h.due))];if(days.length>1)return n;
 const due=days[0]||scheduled.due,aliasDues=[...new Set([scheduled.due,...history.map(h=>h.due)])];
 return {...n,due,label:kind==='six'?'6か月点検':'12か月点検',precision:due.length===7?'month':'day',source:'calculated',aliasDues};
}
export function knownNotices(data,v,through){
 const history=data.history.filter(h=>h.vehicleId===v.id&&h.customerId===v.customerId),scheduled=vehicleNotices(v,through).map(e=>currentCaseNotice(data,{...e,customerId:v.customerId,vehicleId:v.id})),labels=['1か月点検','3か月点検','6か月点検','12か月点検'];
 // Only a unique month/day precision alias of an automatic event is suppressed.
 // Keep every original history and never match another car, type, or month.
 const all=scheduled.filter(e=>{if(e.source!=='calculated'||history.some(h=>h.type===e.type&&h.due===e.due))return true;const monthHistory=history.filter(h=>h.type===e.type&&h.due?.slice(0,7)===e.due.slice(0,7));if(new Set(monthHistory.map(h=>h.due)).size!==1)return true;const matches=monthHistory.filter(h=>h.due.length!==e.due.length&&[7,10].includes(h.due.length));const dues=[...new Set(matches.map(h=>h.due))];return dues.length!==1||matches.some(h=>labels.includes(h.noticeLabel)&&h.noticeLabel!==e.label);});
 for(const h of history){const event=currentCaseNotice(data,{...h,sourceInferred:!['calculated','entered'].includes(h.source),label:h.noticeLabel||TYPES[h.type],precision:h.due.length===7?'month':'day',source:h.source||(h.due.length===7?'calculated':'entered')});if(!all.some(e=>e.type===event.type&&e.due===event.due))all.push(event);}return all;
}
// Exclusions are exact vehicle/service/due display preferences; history is never removed.
export function noticeExcluded(v,n){return Array.isArray(v?.excludedNotices)&&v.excludedNotices.some(x=>x.type===n.type&&(x.due===n.due||n.aliasDues?.includes(x.due)));}
export function excludedCases(data){return data.vehicles.flatMap(v=>{const customer=activeCustomers(data).find(c=>c.id===v.customerId);return customer?(v.excludedNotices||[]).map(notice=>({customer,vehicle:v,notice})):[];});}
export function setNoticeExcluded(data,vehicleId,type,due,excluded=true){
 const v=data.vehicles.find(v=>v.id===vehicleId);if(!v||!activeCustomers(data).some(c=>c.id===v.customerId)||!TYPES[type]||!validRegistrationDate(due))throw Error('除外する車両・案件を確認してください');
 const view=currentCaseNotice(data,{customerId:v.customerId,vehicleId:v.id,type,due}),keys=view.aliasDues||[due],previous=v.excludedNotices||[],found=previous.find(x=>x.type===type&&keys.includes(x.due));
 if(excluded){if(found)return false;const event=knownNotices(data,v,due).find(n=>n.type===type&&n.due===due);if(!event)throw Error('除外する案件が見つかりません');v.excludedNotices=[...previous,{type,due,label:event.label||TYPES[type],excludedAt:TODAY}];}
 else{if(!found)return false;v.excludedNotices=previous.filter(x=>x.type!==type||!keys.includes(x.due));}
 return true;
}
function validateNoticeExclusions(value){if(value===undefined)return;if(!Array.isArray(value)||value.some(x=>!x||!TYPES[x.type]||!validRegistrationDate(x.due)||typeof x.label!=='string'||x.label.length>100||!validDate(x.excludedAt)))throw Error('案件の除外情報が不正です');}
export function contactLane(status){return !status||status==='未連絡'?'uncontacted':['予約済','入庫済','今回は見送り'].includes(status)?'completed':'inprogress';}

// Raw schedules/history stay intact. Only routine guidance collapses uncontacted
// calculated inspections up to a shaken whose guidance window has begun.
export function guidanceNotices(data,v,through,start,{keepAll=false}={}){
 const events=knownNotices(data,v,through).filter(n=>!outsideCurrentInspectionCycle(v,n));if(keepAll)return events;
 const shaken=events.filter(e=>e.type==='shaken'&&validRegistrationDate(e.due)&&noticeStart(e.due.slice(0,7)+'-01','shaken')<=start);
 if(!shaken.length)return events;
 const monthIndex=value=>Number(value.slice(0,4))*12+Number(value.slice(5,7));
 return events.filter(e=>e.type!=='inspection'||e.source!=='calculated'||data.history.some(h=>h.vehicleId===v.id&&h.type===e.type&&h.due===e.due)||!shaken.some(s=>{const gap=monthIndex(s.due)-monthIndex(e.due);return gap>=0&&gap<=6;})).sort((a,b)=>Number(!shaken.includes(a))-Number(!shaken.includes(b))||a.due.localeCompare(b.due));
}
function sortGuidanceItems(items,filter){
 const sorted=items.sort((a,b)=>a.due.localeCompare(b.due));
 if(filter.range||filter.type==='inspection')return sorted;
 for(const id of new Set(sorted.map(i=>i.vehicle.id))){
  const slots=sorted.map((item,index)=>item.vehicle.id===id?index:-1).filter(index=>index>=0);
  const own=slots.map(index=>sorted[index]);if(!own.some(i=>i.type==='shaken'))continue;
  own.sort((a,b)=>Number(a.type!=='shaken')-Number(b.type!=='shaken')||a.due.localeCompare(b.due));
  slots.forEach((slot,index)=>sorted[slot]=own[index]);
 }
 return sorted;
}
export function latest(data,v,type,due=v[type]){return data.history.map((h,index)=>({h,index})).filter(({h})=>h.customerId===v.customerId&&h.vehicleId===v.id&&h.type===type&&currentCaseNotice(data,h).due===currentCaseNotice(data,{customerId:v.customerId,vehicleId:v.id,type,due}).due).sort((a,b)=>a.h.date.localeCompare(b.h.date)||a.index-b.index).at(-1)?.h;}
export function targets(data,f={}){const today=f.today||TODAY;const [start,end]=f.range||monthRange(today,f.month||0);if(!validDate(start)||!validDate(end)||start>end)throw Error('期間を正しい日付で入力してください');const through=f.range?end:monthRange(start,3)[1];let groups=[];
 for(const c of data.customers){if(c.deletedAt||c.pref==='連絡不要')continue;let items=[],seen=new Set();for(const v of data.vehicles.filter(v=>v.customerId===c.id&&v.state==='管理中'))for(const event of guidanceNotices(data,v,through,start,{keepAll:!!f.range||f.type==='inspection'})){
 if(noticeExcluded(v,event))continue;const {type,due,precision}=event;if(!validRegistrationDate(due)||precision==='day'&&!validDate(due)||f.type&&f.type!=='all'&&type!==f.type)continue;const key=JSON.stringify([c.id,v.id,type,due]);if(seen.has(key))continue;seen.add(key);const h=latest(data,v,type,due),closed=['予約済','入庫済'].includes(h?.status),contacted=!!h&&h.status!=='未連絡';const lane=contactLane(h?.status),requested=f.contactState||'uncontacted';if(requested==='contacted'?!contacted:lane!==requested)continue;
 const [lower,upper]=precision==='month'?monthRange(due+'-01'):[due,due],delta=precision==='day'?days(due,today):null,overdue=upper<today,soon=delta!==null&&delta>=0&&delta<=14,notice=noticeStart(lower,type);
 if(f.range){if(!(lower<=end&&upper>=start)&&!(f.addOverdue&&overdue))continue;}
 else{if(notice>start||f.addOverdue===false&&overdue)continue;}
 if(f.urgency==='overdue'&&!overdue||f.urgency==='soon'&&!soon)continue;
 items.push({vehicle:v,...event,noticeStart:notice,delta,overdue,soon,status:h?.status||'未連絡',retry:h?.retry||'',closed,contacted,contactId:h?.contactId||h?.id||''});}
 if(items.length)groups.push({customer:c,items:sortGuidanceItems(items,f)});}
 return groups.sort((a,b)=>a.items[0].due.localeCompare(b.items[0].due));}
export function validateCustomer(c){
 if(typeof c.name!=='string'||!c.name.trim()||c.name.trim().length>60)throw Error('氏名を60文字以内で入力してください');
 if(typeof c.phone!=='string'||c.phone&&(!/^[+0-9() -]{3,30}$/.test(c.phone)||!/[0-9]/.test(c.phone)))throw Error('電話番号は数字・ハイフン等で入力してください');
 if(typeof c.email!=='string'||c.email&&(c.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)))throw Error('メールアドレスの形式を確認してください');
 if(c.nameReading!==undefined)normalizeCustomerReading(c.nameReading);
 if(c.notes!==undefined&&(typeof c.notes!=='string'||c.notes.length>2000))throw Error('顧客メモは2000文字以内で入力してください');
 if(!PREFS.includes(c.pref)||!['不明','可','不可'].includes(c.sms))throw Error('連絡方法を選択してください');return c;
}
export function validateVehicle(v){validateNoticeExclusions(v.excludedNotices);v={...v,firstRegistration:normalizeDateInput(v.firstRegistration??'',{allowMonth:true}),inspection:normalizeDateInput(v.inspection??''),shaken:normalizeDateInput(v.shaken??'')};const bundledPlan=v.bundledPlan??'未確認';if(!BUNDLED_PLANS.includes(bundledPlan))throw Error('おまとめプランを選択してください');const numberLast4=validateNumber(numberValue(v));for(const k of Object.keys(TYPES))if(v[k]&&!validDate(v[k]))throw Error('日付が不正です。YYYY-MM-DDで入力してください');if(!['管理中','売却済','担当外'].includes(v.state))throw Error('車両状態を選択してください');const firstRegistration=v.firstRegistration??'',insurance=v.insurance??'未確認',jaf=v.jaf??'未確認';if(typeof firstRegistration!=='string'||firstRegistration&&!validRegistrationDate(firstRegistration))throw Error('初度登録は正しいYYYY-MMまたはYYYY-MM-DDで入力してください');if(!INSURANCES.includes(insurance))throw Error('保険は自社・他社・未確認から選択してください');if(!JAF_OPTIONS.includes(jaf))throw Error('JAFは有・無・未確認から選択してください');const scheduleMode=v.pricing?.commercial?'manual':v.scheduleMode??'private-passenger';if(!SCHEDULE_MODES.some(([k])=>k===scheduleMode))throw Error('予定計算の適用を選択してください');const scheduleAnchor=scheduleMode==='private-passenger'?(v.scheduleAnchor||adoptionMonth(TODAY)):'';if(scheduleAnchor&&!/^\d{4}-\d{2}$/.test(scheduleAnchor)||scheduleAnchor&&!validRegistrationDate(scheduleAnchor))throw Error('予定計算の開始月が不正です');return {...v,numberLast4,firstRegistration,insurance,jaf,scheduleMode,scheduleAnchor,bundledPlan,menproEnrollment:normalizeEnrollment(v.menproEnrollment),...(v.vehicleOutlook!==undefined?{vehicleOutlook:normalizeOutlook(v.vehicleOutlook)}:{})};}
export function record(data,r){r={...r,date:normalizeDateInput(r.date),retry:normalizeDateInput(r.retry??'')};const v=data.vehicles.find(v=>v.id===r.vehicleId),due=r.due||v?.[r.type],event=v&&due&&knownNotices(data,v,due).find(e=>e.type===r.type&&(e.due===due||e.aliasDues?.includes(due)));if(!activeCustomers(data).some(c=>c.id===r.customerId)||!v||v.customerId!==r.customerId||!event||!validRegistrationDate(due)||(event.source==='entered'&&!validDate(due))||!STATUSES.includes(r.status)||!validDate(r.date)||r.retry&&(!validDate(r.retry)||r.retry<r.date))throw Error('対象・状態・日付・再連絡日を確認してください');if(r.note!==undefined&&(typeof r.note!=='string'||r.note.length>10000))throw Error('メモは10000文字以内で入力してください');validateHistoryLink(data,{...r,due});const h={...r,due,noticeLabel:event.label,source:event.source,id:crypto.randomUUID()};data.history.push(h);return h;}
export function updateCustomerNotes(data,customerId,notes){const i=data.customers.findIndex(c=>c.id===customerId);if(i<0||data.customers[i].deletedAt)throw Error('顧客が見つかりません');const c=validateCustomer({...data.customers[i],notes});data.customers[i]=c;return c;}

// Updates are append-only records; the linked contact keeps its original contact month.
export function validateHistoryLink(data,h){
 if(h.entryKind===undefined&&h.contactId===undefined)return;
 if(h.entryKind!=='status-update'||typeof h.contactId!=='string')throw Error('状況更新の形式が不正です');
 const base=data.history.find(x=>x.id===h.contactId);
 if(!base||base.entryKind==='status-update'||base.id===h.id||base.customerId!==h.customerId||base.vehicleId!==h.vehicleId||base.type!==h.type||base.due!==h.due||h.date<base.date)throw Error('状況更新の参照先・日付が不正です');
}
export function updateContactStatus(data,contactId,input){
 const base=data.history.find(h=>h.id===contactId&&!h.entryKind);
 if(!base)throw Error('更新する連絡記録が見つかりません');
 const date=normalizeDateInput(input.date);
 const lastDate=data.history.filter(h=>h.id===contactId||h.contactId===contactId).map(h=>h.date).sort().at(-1);
 if(date<lastDate)throw Error('更新日は、この連絡の最新の記録日以降にしてください');
 // Validate without mutating. An unchanged status edit is not a new contact.
 const latest=data.history.filter(h=>h.customerId===base.customerId&&h.vehicleId===base.vehicleId&&h.type===base.type&&currentCaseNotice(data,h).due===currentCaseNotice(data,base).due).reduce((a,h)=>!a||h.date>=a.date?h:a,null);
 if(latest&&latest.status===input.status&&(latest.retry??'')===normalizeDateInput(input.retry??'')&&(latest.note??'')===(input.note??'')){record({...data,history:[...data.history]},{customerId:base.customerId,vehicleId:base.vehicleId,type:base.type,due:base.due,status:input.status,date,retry:'',note:input.note??'',entryKind:'status-update',contactId});return null;}
 const candidate=record({...data,history:[...data.history]},{customerId:base.customerId,vehicleId:base.vehicleId,type:base.type,due:base.due,status:input.status,date,retry:input.retry??'',note:input.note??'',entryKind:'status-update',contactId});
 data.history.push(candidate);return candidate;
}

// Month/day entry only; stored history remains an ISO calendar date.
export function retryInputValue(iso){return iso?iso.slice(5).replace('-','/'):'';}
export function normalizeRetryDate(value,baseDate,previous=''){
 if(value===undefined||value===null||String(value).trim()==='')return '';
 const m=String(value).trim().match(/^(\d{1,2})[\/](\d{1,2})$/);if(!m)throw Error('再連絡日は月/日で入力してください（例：1/15）');
 const base=normalizeDateInput(baseDate);if(!validDate(base))throw Error('連絡日・更新日を確認してください');
 const md=m[1].padStart(2,'0')+'-'+m[2].padStart(2,'0');let year=Number(previous&&validDate(previous)?previous.slice(0,4):base.slice(0,4));
 if(!previous&&md<base.slice(5))year++;
 const result=year+'-'+md;if(!validDate(result))throw Error('再連絡日の月日が正しくありません（'+year+'年）');
 return result;
}

export function normalizeCustomerReading(value){
 if(value===undefined||value===null)return '';
 if(typeof value!=='string'||value.length>120)throw Error('ふりがなは120文字以内のひらがな・カタカナで入力してください');
 const reading=value.normalize('NFKC').trim().replace(/\s+/g,' ').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
 if(reading&&!/^[ぁ-ゖー ゝゞ]+$/.test(reading))throw Error('ふりがなはひらがな・カタカナで入力してください');return reading;
}
export function customerReadingGroups(data){
 const definitions=[['あ','ぁあぃいぅうぇえぉお'],['か','かきくけこゕゖ'],['さ','さしすせそ'],['た','たちっつてと'],['な','なにぬねの'],['は','はひふへほ'],['ま','まみむめも'],['や','ゃやゅゆょよ'],['ら','らりるれろ'],['わ','ゎわゐゑをん']];
 const groups=definitions.map(([key])=>({key,label:key+'行',customers:[]}));groups.push({key:'unread',label:'読み未登録',customers:[]});
 for(const c of activeCustomers(data)){const reading=normalizeCustomerReading(c.nameReading),first=reading.normalize('NFD').replace(/[\u3099\u309a]/g,'')[0],i=definitions.findIndex(([,letters])=>letters.includes(first));groups[i<0?10:i].customers.push(c);}
 for(const g of groups)if(g.key!=='unread')g.customers.sort((a,b)=>normalizeCustomerReading(a.nameReading).localeCompare(normalizeCustomerReading(b.nameReading),'ja'));
 return groups;
}

export function customerSearchKey(value){return String(value??'').normalize('NFKC').toLowerCase().replace(/[ぁ-ゖ]/g,c=>String.fromCharCode(c.charCodeAt(0)+0x60)).replace(/\s+/g,'');}
// Normalize only number searches; keep names and stored values unchanged.
function numberSearchKey(value){const key=customerSearchKey(value).replace(/[-‐‑‒–—―−ー]/g,'');return /^\d{1,4}$/.test(key)?key:'';}
export function searchCustomers(data,query){
 const key=customerSearchKey(query);if(!key)return [];
 const numberKey=numberSearchKey(query);
 return activeCustomers(data).filter(c=>[c.name,c.nameReading].some(value=>customerSearchKey(value).includes(key))||data.vehicles.filter(v=>v.customerId===c.id).some(v=>{
  const value=numberValue(v);
  return customerSearchKey(value).includes(key)||!!numberKey&&numberSearchKey(value).includes(numberKey);
 }));
}
