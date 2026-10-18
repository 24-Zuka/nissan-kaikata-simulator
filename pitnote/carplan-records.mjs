const text=(v,max=200)=>typeof v==='string'&&v.length<=max;
const iso=v=>text(v,40)&&Number.isFinite(Date.parse(v));
const clone=v=>JSON.parse(JSON.stringify(v));
export function comparisonContext(data,vehicleId){
 const v=data.vehicles.find(v=>v.id===vehicleId),c=v&&data.customers.find(c=>c.id===v.customerId&&!c.deletedAt);
 if(!v||!c)throw Error('顧客・車両が見つかりません');
 return {customerId:c.id,vehicleId:v.id,customerName:c.name,vehicleName:v.model,numberLast4:v.numberLast4||'',firstRegistrationMonth:(v.firstRegistration||'').slice(0,7),nextInspectionMonth:(v.shaken||'').slice(0,7),capturedAt:new Date().toISOString()};
}
export function validComparison(r){
 const s=r?.scenario,l=s?.customerLink;
 return r&&text(r.id)&&!!r.id&&iso(r.createdAt)&&iso(r.updatedAt)&&s?.schemaVersion===11&&l
  &&['customerId','vehicleId','customerName','vehicleName','numberLast4','firstRegistrationMonth','capturedAt'].every(k=>text(l[k]))
  &&l.customerId&&l.vehicleId&&iso(l.capturedAt)
  &&['quote','vehicle','currentCar','newMaintenance','usedMaintenance','cash','credit','bvc','omatome','comparison'].every(k=>s[k]&&typeof s[k]==='object'&&!Array.isArray(s[k]))
  &&text(s.quote.customerName)&&text(s.quote.scenarioName)&&text(s.quote.quoteDate,20);
}
export function validateCarplanData(data){
 if(data.carplanComparisons!==undefined){
  if(!Array.isArray(data.carplanComparisons)||!data.carplanComparisons.every(validComparison))throw Error('CarPlanの比較データが不正です。元データは変更しません');
  const ids=new Set();for(const r of data.carplanComparisons){const l=r.scenario.customerLink;if(ids.has(r.id)||!data.vehicles.some(v=>v.id===l.vehicleId&&v.customerId===l.customerId))throw Error('CarPlanの比較ID・顧客車両関連が不正です');ids.add(r.id);}
 }
 if(data.carplanTemplates!==undefined&&(!Array.isArray(data.carplanTemplates)||data.carplanTemplates.some(t=>!t||!text(t.id)||!text(t.name)||!text(t.model)||!text(t.grade)||!text(t.drive)||!iso(t.updatedAt)||!t.terms)))throw Error('CarPlanの概算設定が不正です');
}
export function comparisonsFor(data,customerId,vehicleId){return clone((data.carplanComparisons||[]).filter(r=>r.scenario.customerLink.customerId===customerId&&r.scenario.customerLink.vehicleId===vehicleId));}
export function saveComparison(data,context,incoming){
 if(!validComparison(incoming))throw Error('比較データの形式が不正です');
 const l=incoming.scenario.customerLink;
 if(l.customerId!==context.customerId||l.vehicleId!==context.vehicleId)throw Error('別の顧客・車両の比較は保存できません');
 const existing=(data.carplanComparisons||[]).find(r=>r.id===incoming.id);
 if(existing&&(existing.scenario.customerLink.customerId!==context.customerId||existing.scenario.customerLink.vehicleId!==context.vehicleId))throw Error('比較IDが別の顧客に使われています');
 const record=clone({...incoming,createdAt:existing?.createdAt||incoming.createdAt,updatedAt:new Date().toISOString()});
 if(existing)record.scenario.customerLink=clone(existing.scenario.customerLink);
 const next={...data,carplanComparisons:[record,...(data.carplanComparisons||[]).filter(r=>r.id!==record.id)]};
 validateCarplanData(next);return {data:next,record};
}
