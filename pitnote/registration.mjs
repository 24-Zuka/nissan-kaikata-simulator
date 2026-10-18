import {activeCustomers,validateCustomer,validateVehicle,escapeHtml as esc} from './core.mjs';
import {vehicleTitle,bundledVehicleClass} from './vehicle-label.mjs';
import {numberLabel} from './vehicle-number.mjs';

export function registrationContext(data,customerId='',vehicleId='',addingVehicle=false){
 const customer=customerId?activeCustomers(data).find(c=>c.id===customerId):undefined;
 const vehicle=vehicleId?data.vehicles.find(v=>v.id===vehicleId):undefined;
 if(customerId&&!customer)throw Error('顧客が見つかりません。登録一覧から選び直してください');
 if(vehicleId&&(!vehicle||!customer||vehicle.customerId!==customer.id))throw Error('車両と顧客の関連を確認してください。登録一覧から選び直してください');
 if(addingVehicle&&(!customer||vehicle))throw Error('車両の追加先を選び直してください');
 return {mode:vehicle?'vehicle':customer?(addingVehicle?'add':'customer'):'create',customerId,vehicleId,customer,vehicle};
}

// Apply only a validated, explicit edit scope. No array replacement, deletion, or ID reassignment.
export function commitRegistration(data,context,customerPatch,vehicleDraft){
 const current=registrationContext(data,context.customerId,context.vehicleId,context.mode==='add');
 if(current.mode!==context.mode)throw Error('編集対象が変わりました。登録一覧から選び直してください');
 if(current.mode==='customer'&&vehicleDraft!==undefined)throw Error('顧客編集では車両を変更できません');
 if(current.mode!=='customer'&&!vehicleDraft)throw Error('車両の入力内容を確認してください');
 const c=validateCustomer({...current.customer,...customerPatch,id:current.customer?.id||crypto.randomUUID()});
 let v;
 if(vehicleDraft){
  if(typeof vehicleDraft.model!=='string'||!vehicleDraft.model.trim())throw Error('車種を入力してください');
  v=validateVehicle({...current.vehicle,...vehicleDraft,id:current.vehicle?.id||crypto.randomUUID(),customerId:c.id});
  if(v.bundledPlan==='あり'&&v.menproEnrollment.status==='加入')throw Error('おまとめプランとメンプロ加入は同時に登録できません');
 }
 // All validation finishes before the first mutation, including for a new customer + vehicle.
 const ci=data.customers.findIndex(x=>x.id===c.id);
 if(ci<0)data.customers.push(c);else data.customers[ci]=c;
 if(v){const vi=data.vehicles.findIndex(x=>x.id===v.id);if(vi<0)data.vehicles.push(v);else data.vehicles[vi]=v;}
 return {customer:c,vehicle:v};
}

export function customerVehiclesSummary(data,customer){
 const vehicles=data.vehicles.filter(v=>v.customerId===customer.id);
 const date=s=>s?s.replaceAll('-','/'):'未登録';
 return `<section class="customer-edit-vehicles"><h3>登録済みの車両 <span>${vehicles.length}台</span></h3><p class="helper">顧客情報の変更では車両情報を変更しません。車両を変更するときは、その車両の「車両を編集」を選んでください。</p>${vehicles.map(v=>`<div class="registry-row${bundledVehicleClass(v)}"><div>${vehicleTitle(v)}<small>${esc(numberLabel(v))} · ${esc(v.state)}</small><small>初度登録 ${esc(date(v.firstRegistration))} · 点検 ${esc(date(v.inspection))} · 車検 ${esc(date(v.shaken))}</small></div><button type="button" class="secondary" data-edit-vehicle="${esc(v.id)}">車両を編集</button></div>`).join('')||'<p class="helper">車両はまだ登録されていません。</p>'}<button type="button" class="secondary" data-add-vehicle="${esc(customer.id)}">この顧客に車両を追加</button></section>`;
}

// Validate the complete batch before mutating one customer or any vehicle.
export function commitRegistrationBatch(data,context,customerPatch,vehicleDrafts){
 const current=registrationContext(data,context.customerId,context.vehicleId,context.mode==='add');
 if(!['create','add'].includes(context.mode)||current.mode!==context.mode)throw Error('複数台の追加先を確認してください');
 if(!Array.isArray(vehicleDrafts)||!vehicleDrafts.length)throw Error('追加する車両を入力してください');
 const customer=validateCustomer({...current.customer,...customerPatch,id:current.customer?.id||crypto.randomUUID()}),ids=new Set(data.vehicles.map(v=>v.id));
 const vehicles=vehicleDrafts.map((draft,index)=>{if(!draft?.model?.trim())throw Error((index+1)+'台目の車種を入力してください');const v=validateVehicle({...draft,id:draft.id||crypto.randomUUID(),customerId:customer.id});if(ids.has(v.id))throw Error('追加車両のIDが重複しています');ids.add(v.id);if(v.bundledPlan==='あり'&&v.menproEnrollment.status==='加入')throw Error((index+1)+'台目のおまとめ・メンプロ加入が重複しています');return v;});
 const i=data.customers.findIndex(c=>c.id===customer.id);if(i<0)data.customers.push(customer);else data.customers[i]=customer;data.vehicles.push(...vehicles);return {customer,vehicles};
}
