// Compatibility exports for the app. The shipped standard is always authoritative.
// Never open, migrate, delete, or overwrite an older device pricing database.
import {STANDARD_MASTER, STANDARD_PRICING_VERSION} from './standard-pricing.mjs';
export {STANDARD_PRICING_VERSION};
export const PRIVATE_MASTER=STANDARD_MASTER;
export const PRICE_DATA=Object.freeze({...STANDARD_MASTER.priceData,available:true});
export const VEHICLE_MASTER=STANDARD_MASTER.vehicleMaster;
export const COMMERCIAL_MODELS=STANDARD_MASTER.commercialModels;
export const MASTER_STATUS=`内蔵標準料金 · ${STANDARD_PRICING_VERSION}`;
const LIMIT=4*1024*1024;
export function validateMaster(text){
 if(typeof text!=='string'||new TextEncoder().encode(text).length>LIMIT)throw Error('料金ファイルは4MB以内にしてください');
 const m=JSON.parse(text,(k,v)=>{if(['__proto__','prototype','constructor'].includes(k))throw Error('不正な項目があります');return v;});
 if(m?.format!=='PITNOTE-PRIVATE-PRICING'||m.schemaVersion!==1||!Array.isArray(m.vehicleMaster)||!m.priceData||!m.commercialModels)throw Error('対応する料金ファイルではありません');
 for(const k of ['inspection','businessInspection','oil','tire','tireWork','menpro']){const p=m.priceData[k];if(!p||typeof p.cells!=='object'||p.cells===null||typeof p.sheet!=='string')throw Error('料金表の形式が不正です');for(const [cell,value]of Object.entries(p.cells))if(!/^[A-Z]+[1-9][0-9]*$/.test(cell)||!['number','string'].includes(typeof value)||typeof value==='number'&&(!Number.isFinite(value)||value<0))throw Error('料金セルが不正です');}
 if(!m.priceData.sources||!m.priceData.menproRows||!Number.isFinite(m.priceData.tpmsUnit)||m.priceData.tpmsUnit<=0)throw Error('料金の出典・付帯条件が不足しています');
 const ids=new Set();for(const v of m.vehicleMaster){if(!v||typeof v.id!=='string'||ids.has(v.id)||typeof v.name!=='string'||!v.name||!Array.isArray(v.reasons))throw Error('車種表が不正です');ids.add(v.id);}
 return m;
}
// Retain the old API with an explicit refusal instead of silently replacing prices.
export async function importMaster(){
 throw Error('内蔵標準料金を使用しています。料金改定資料を渡してアプリの更新を依頼してください。端末の料金取込には対応していません。');
}
