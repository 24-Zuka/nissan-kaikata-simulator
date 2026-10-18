import {validateCarplanData} from './carplan-records.mjs';
import {validateCustomer,validateVehicle,validDate,validRegistrationDate,STATUSES,TYPES,validateHistoryLink} from './core.mjs';
export const DB_NAME='pitnote-local-v1', MAX_BYTES=10*1024*1024;
export function normalizeSnapshot(input){
 const version=input?.schemaVersion??1;
 if(![1,2].includes(version))throw Error('未対応のデータ版です。元のデータは変更しません');
 const data=input?.data??input;
 if(!data||!['customers','vehicles','history'].every(k=>Array.isArray(data[k])))throw Error('顧客・車両・履歴の形式が不正です');
 const text=JSON.stringify(data);if(new TextEncoder().encode(text).length>MAX_BYTES)throw Error('保存データの10MB上限を超えています');
 const d=JSON.parse(text,(k,v)=>{if(['__proto__','prototype','constructor'].includes(k))throw Error('不正な項目を含みます');return v;});
 const ids=new Set();for(const c of d.customers){if(!c||typeof c.id!=='string'||!c.id||ids.has(c.id))throw Error('顧客IDが不正または重複しています');ids.add(c.id);if(typeof c.phone!=='string'||typeof c.email!=='string')throw Error('電話とメールは文字列で保持してください');validateCustomer(c);if(c.deletedAt&&!validDate(c.deletedAt))throw Error('削除日が不正です');}
 const vehicles=new Map();d.vehicles=d.vehicles.map(v=>{if(!v||typeof v.id!=='string'||!v.id||vehicles.has(v.id)||!ids.has(v.customerId)||typeof v.model!=='string'||!v.model)throw Error('車両の関連が不正です');vehicles.set(v.id,v.customerId);return validateVehicle(v);});
 const hs=new Set();for(const h of d.history){if(!h||typeof h.id!=='string'||!h.id||hs.has(h.id)||vehicles.get(h.vehicleId)!==h.customerId||!TYPES[h.type]||!STATUSES.includes(h.status)||!validDate(h.date)||!validRegistrationDate(h.due)||h.retry&&(!validDate(h.retry)||h.retry<h.date)||h.note!==undefined&&(typeof h.note!=='string'||h.note.length>10000))throw Error('履歴の関連・日付・形式が不正です');hs.add(h.id);}
 for(const h of d.history)validateHistoryLink(d,h);
 validateCarplanData(d);
 return {schemaVersion:2,data:d};
}
export async function openStore(name=DB_NAME){
 if(!globalThis.indexedDB)throw Error('このブラウザーでは端末保存を利用できません');
 const db=await new Promise((resolve,reject)=>{let ended=false;const r=indexedDB.open(name,1);r.onupgradeneeded=()=>r.result.createObjectStore('state');r.onerror=r.onblocked=()=>{ended=true;reject(Error('保存領域を開けません。別の画面を閉じて再確認してください'));};r.onsuccess=()=>ended?r.result.close():resolve(r.result);});
 db.onversionchange=()=>db.close();
 const read=key=>new Promise((resolve,reject)=>{let value;const tx=db.transaction('state','readonly'),r=tx.objectStore('state').get(key);r.onsuccess=()=>value=r.result;tx.oncomplete=()=>resolve(value??null);tx.onabort=()=>reject(Error('保存データを読み込めません'));});
 return {read,close:()=>db.close(),async load(){const row=await read('current');if(!row)return null;return {...row,...normalizeSnapshot(row),revision:row.revision??0};},
 async save(input,expectedRevision,{preserve=false}={}){
  const snapshot=normalizeSnapshot(input);if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0)throw Error('版番号が不正です');
  return new Promise((resolve,reject)=>{let row,error;const tx=db.transaction('state','readwrite'),s=tx.objectStore('state'),r=s.get('current');
   r.onsuccess=()=>{try{if((r.result?.revision??0)!==expectedRevision){error=Error('別の画面で更新されました。バックアップを書き出してから再読み込みしてください');tx.abort();return;}row={...snapshot,revision:expectedRevision+1,updatedAt:new Date().toISOString()};if(preserve&&r.result)s.put(r.result,'beforeRestore');s.put(row,'current');}catch(e){error=Error('端末に保存できませんでした（容量・ブラウザー設定等）。未保存の変更はバックアップしてください');tx.abort();}};
   tx.oncomplete=()=>resolve(row);tx.onabort=()=>reject(error||Error('端末に保存できませんでした（容量・ブラウザー設定等）。未保存の変更はバックアップしてください'));
  });
 }};
}
export async function createLocalState(seed,{name=DB_NAME}={}){
 let db,revision=0,committed='',pending=Promise.resolve(),blocked=false,restoring=false;
 const state={data:seed(),status:'端末保存を確認中',error:false,updatedAt:'',raw:null};
 const update=(message,error=false)=>{state.status=message;state.error=error;globalThis.dispatchEvent?.(new Event('pitnote-save-status'));};
 try{db=await openStore(name);state.raw=await db.read('current');const row=await db.load();if(row){state.data=row.data;revision=row.revision;state.updatedAt=row.updatedAt||'';committed=JSON.stringify(row.data);if(state.raw.schemaVersion!==2){const migrated=await db.save(row,revision,{preserve:true});revision=migrated.revision;state.updatedAt=migrated.updatedAt;}}else{const row=await db.save(state.data,0);state.data=row.data;revision=row.revision;state.updatedAt=row.updatedAt;committed=JSON.stringify(row.data);}update('この端末に保存済み');}
 catch(e){blocked=true;update(e.message+'。元の保存領域は自動上書きしません',true);}
 state.track=data=>{
  let snapshot,text;try{snapshot=normalizeSnapshot(data);text=JSON.stringify(snapshot.data);}catch(e){update(e.message,true);return;}
  if(blocked||restoring||text===committed)return;
  state.data=data;update('端末に保存中…');
  pending=pending.then(async()=>{if(blocked||text===committed)return;try{const row=await db.save(snapshot,revision);revision=row.revision;state.updatedAt=row.updatedAt;committed=text;update('この端末に保存済み');}catch(e){blocked=true;update(e.message,true);}});return pending;
 };
 state.flush=()=>pending;
 state.restore=async data=>{restoring=true;try{await pending;if(!db)throw Error('保存領域を開けないため復元できません');const snapshot=normalizeSnapshot(data),raw=await db.read('current');const row=await db.save(snapshot,raw?.revision??0,{preserve:true});state.data=row.data;state.raw=row;revision=row.revision;committed=JSON.stringify(row.data);state.updatedAt=row.updatedAt;blocked=false;update('復元して端末に保存しました');return row.data;}finally{restoring=false;}};
 state.recovery=async()=>db?await db.read('beforeRestore'):null;
 state.rawCurrent=async()=>db?await db.read('current'):null;
 state.dirty=()=>blocked||JSON.stringify(state.data)!==committed;
 return state;
}
