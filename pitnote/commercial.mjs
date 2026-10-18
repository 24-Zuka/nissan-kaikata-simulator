// All prices remain in price-data.mjs with source sheet/cell provenance.
export const COMMERCIAL_KEYS=['commercialUse','commercialBand','commercialFuel','commercial','commercialSupported','masterId'];
export const COMMERCIAL_USE=[['未確認','用途を確認'],['private','自家用貨物（積載2t未満・レンタカー等除外）'],['business','運送事業用貨物'],['other','乗用・マイクロ・その他（個別確認）']];
import {COMMERCIAL_MODELS} from './private-master.mjs';
export {COMMERCIAL_MODELS};
import {PRICE_DATA} from './private-master.mjs';
export function commercialProfile(p,conditions={}){
 const c=COMMERCIAL_MODELS[p.masterId||p.id];if(!c)return p;
 const commercialUse=conditions.commercialUse||p.commercialUse||'未確認';
 const commercialBand=c.band==='未確認'?(conditions.commercialBand||p.commercialBand||'未確認'):c.band;
 const commercialFuel=conditions.commercialFuel||p.commercialFuel||'未確認';
 const caravan=c.fuelSelectable===true;
 const oilClass=c.oil||(caravan?(c.fuelMap?.[commercialFuel]||'未確認'):'未確認');
 return {...p,commercial:true,commercialSupported:true,commercialUse,commercialBand,commercialFuel,inspectionClass:commercialBand,vehicleClass:commercialBand,menproGroup:c.group,menproClass:c.pack,oilClass,productType:'商用車',mappingNote:'貨物の料金表を用途で切替。予定の自動計算は対象外・実期限を入力。'+(c.bandSelectable===true?'原表の適用欄を確認してください。':'')+(oilClass==='未確認'?'油の区分が未確定のため初期額に油を含めません。':'油は個人のお客様向け掲載額。法人は個別確認。')};
}
export function commercialColumns(d){
 if(!d.commercialSupported||!['private','business'].includes(d.commercialUse))return null;
 const cols=PRICE_DATA.commercialColumns?.[d.commercialBand];
 return cols?{key:d.commercialUse==='private'?'inspection':'businessInspection',col:cols[d.commercialUse==='private'?0:1],cargo:d.commercialBand!=='軽商用',business:d.commercialUse==='business'}:null;
}
