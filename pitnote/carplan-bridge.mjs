import {maintenanceReference} from './carplan-maintenance.mjs';
import {comparisonContext,comparisonsFor,saveComparison,validateCarplanData} from './carplan-records.mjs';
export function mountCarplan({getData,commit,vehicleId}){
 const context=comparisonContext(getData(),vehicleId);
 const dialog=document.createElement('dialog');dialog.className='carplan-dialog';dialog.setAttribute('aria-label','CarPlan 顧客の購入比較');
 const frame=document.createElement('iframe');frame.title='CarPlan 購入・維持費比較';frame.src='./carplan/embed.html';dialog.append(frame);document.body.append(dialog);
 const nonce=crypto.randomUUID();let dirty=false,busy=false;
 const send=message=>frame.contentWindow?.postMessage({...message,nonce},location.origin);
 const close=()=>{if(busy){alert('保存処理が終わるまでお待ちください');return;}if(dirty&&!confirm('未保存の比較を破棄して閉じますか？'))return;window.removeEventListener('message',receive);dialog.remove();};
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 const receive=async e=>{
  if(e.origin!==location.origin||e.source!==frame.contentWindow)return;
  const m=e.data;if(!m||typeof m!=='object')return;
  if(m.type==='carplan:ready'){send({type:'pitnote:init',context,records:comparisonsFor(getData(),context.customerId,context.vehicleId),templates:getData().carplanTemplates||[],currentReference:maintenanceReference(getData().vehicles.find(v=>v.id===context.vehicleId))});return;}
  if(m.nonce!==nonce)return;
  if(m.type==='carplan:dirty'){dirty=m.dirty===true;return;}
  if(m.type==='carplan:close'){close();return;}
  if(!['carplan:save','carplan:templates'].includes(m.type)||busy)return;
  busy=true;
  try{
   let next,record;
   if(m.type==='carplan:save')({data:next,record}=saveComparison(getData(),context,m.record));
   else {next={...getData(),carplanTemplates:m.templates};validateCarplanData(next);}
   await commit(next);
   send({type:'pitnote:saved',requestId:m.requestId,record,templates:next.carplanTemplates||[]});
  }catch(error){send({type:'pitnote:error',requestId:m.requestId,message:error.message});}
  finally{busy=false;}
 };
 window.addEventListener('message',receive);dialog.showModal();return dialog;
}
