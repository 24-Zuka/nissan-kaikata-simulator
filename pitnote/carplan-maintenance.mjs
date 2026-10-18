import {VEHICLE_MASTER,STANDARD_PRICING_VERSION} from './private-master.mjs';
import {quoteFor,assessVehicleQuote} from './vehicle-pricing.mjs';
export function maintenanceReference(vehicle){
 const profile=vehicle.pricing?.masterId?VEHICLE_MASTER.find(m=>m.id===vehicle.pricing.masterId):VEHICLE_MASTER.find(m=>m.name===vehicle.model);
 const blocked=vehicle.bundledPlan==='あり'||vehicle.menproEnrollment?.status==='加入'||(vehicle.menproEnrollment&&Object.values(vehicle.menproEnrollment).some(v=>v==='加入済み'||v==='加入済'));
 if(!profile||profile.commercial||blocked)return {model:vehicle.model,available:false,reason:blocked?'おまとめ・メンプロの包含範囲と期間を確認して手入力してください。通常料金は加算しません。':'料金マスターの車種・用途を特定できません。手入力してください。'};
 const results=Object.fromEntries(['six','twelve','shaken'].map(service=>{
  const draft=quoteFor(vehicle,null,service),assessment=assessVehicleQuote(vehicle,null,service);
  return [service,{...assessment,draft}];
 }));
 return {model:vehicle.model,available:true,masterVersion:STANDARD_PRICING_VERSION,masterId:profile.id,codes:profile.codes,inspectionClass:profile.inspectionClass,oilClass:profile.oilClass,results};
}
export function maintenanceCatalog(){return VEHICLE_MASTER.filter(m=>!m.commercial).map(m=>maintenanceReference({model:m.name,pricing:{...m,masterId:m.id}}));}
