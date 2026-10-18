// User-requested planning cycle. This module does not establish legal expiry.
export const SCHEDULE_MODES=[['manual','自動計算しない（用途未確認・対象外）'],['private-passenger','自家用乗用車向けの予定を計算']];
const monthIndex=s=>Number(s.slice(0,4))*12+Number(s.slice(5,7))-1;
const monthString=i=>String(Math.floor(i/12)).padStart(4,'0')+'-'+String(i%12+1).padStart(2,'0');
export function shiftRegistration(value,months){
 const month=monthString(monthIndex(value)+months);
 if(value.length===7)return month;
 const [y,m]=month.split('-').map(Number),last=new Date(Date.UTC(y,m,0)).getUTCDate();
 return month+'-'+String(Math.min(Number(value.slice(8,10)),last)).padStart(2,'0');
}
// Only the current inspected cycle: initial 36-month term when evidenced,
// otherwise the final 18/12/6 months of the entered expiry.
export function inspectionCycleGaps(v){return v.firstRegistration&&monthIndex(v.shaken)-monthIndex(v.firstRegistration)===36?[30,24,18,12,6]:[18,12,6];}
export function outsideCurrentInspectionCycle(v,n){
 if(!v||n.type!=='inspection'||n.source!=='calculated'||n.sourceInferred||!v.shaken||v.scheduleMode!=='private-passenger'||v.pricing?.commercial||v.inspection===n.due)return false;
 const gap=monthIndex(v.shaken)-monthIndex(n.due);return gap>Math.max(...inspectionCycleGaps(v))||gap<=0;
}
// Month-based guidance only: preserve entered dates and never round an off-cycle month.
export function inspectionKindFromExpiry(v,due){
 if(v.pricing?.commercial||v.scheduleMode!=='private-passenger'||!v.shaken||!due)return null;
 const gap=monthIndex(v.shaken)-monthIndex(due);
 return gap===0?'shaken':inspectionCycleGaps(v).includes(gap)?(gap%12===0?'twelve':'six'):'未確認';
}
export function vehicleNotices(v,through){
 const list=[];
 for(const type of ['inspection','shaken']){
  if(v[type]){const kind=type==='inspection'?inspectionKindFromExpiry(v,v[type]):null;if(kind!=='shaken')list.push({type,due:v[type],precision:'day',source:'entered',label:type==='shaken'?'車検':kind==='six'?'6か月点検':kind==='twelve'?'12か月点検':kind==='未確認'?'点検（種別要確認）':'点検'});continue;}
  if(v.pricing?.commercial||v.scheduleMode!=='private-passenger'||!v.scheduleAnchor)continue;
  const start=monthIndex(v.scheduleAnchor),end=monthIndex(through);
  // An entered expiry anchors inspection months; never invent an exact inspection day.
  // Keep the original entered expiry and do not infer that its renewal has happened.
  if(type==='inspection'&&v.shaken){
   const expiry=monthIndex(v.shaken);
   for(const gap of inspectionCycleGaps(v)){
    const i=expiry-gap;if(i<start||i>end)continue;
    list.push({type,due:monthString(i),precision:'month',source:'calculated',label:gap%12===0?'12か月点検':'6か月点検'});
   }
   continue;
  }
  if(!v.firstRegistration)continue;
  const base=monthIndex(v.firstRegistration);
  const first=type==='inspection'?6:36,step=type==='inspection'?6:24;
  let n=Math.max(0,Math.ceil((start-base-first)/step));
  for(;base+first+n*step<=end;n++){
   const age=first+n*step,due=shiftRegistration(v.firstRegistration,age);
   if(due.slice(0,7)<v.scheduleAnchor||due.slice(0,4)>'2199')continue;
   list.push({type,due,precision:due.length===7?'month':'day',source:'calculated',label:type==='shaken'?'車検':age%12===0?'12か月点検':'6か月点検',ageMonths:age});
  }
 }
 const shakenMonths=new Set(list.filter(e=>e.type==='shaken').map(e=>e.due.slice(0,7)));
 return list.filter(e=>!(e.source==='calculated'&&e.type==='inspection'&&shakenMonths.has(e.due.slice(0,7))))
  .sort((a,b)=>a.due.localeCompare(b.due)||a.type.localeCompare(b.type));
}
