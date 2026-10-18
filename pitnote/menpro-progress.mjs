import {MENPRO_CATALOG} from './menpro-catalog.mjs';
import {normalizeEnrollment,normalizeEndMonth} from './menpro-enrollment.mjs';

// Explicit inspection/vehicle-test sequences transcribed from the Nissan passenger and EV charts.
// Offsets are relative to the user's final scheduled month, not membership-card expiration.
// Free new-car checks and optional work are excluded from inspection progress.
const templates={
 new54:{offsets:[-42,-36,-30,-24,-18,-12,-6,0],kinds:['twelve','six','twelve','six','shaken','six','twelve','six']},
 longWithShaken:{offsets:[-24,-18,-12,-6,0],kinds:['twelve','six','twelve','six','shaken']},
 longWithoutShaken:{offsets:[-18,-12,-6,0],kinds:['twelve','six','twelve','six']},
 eighteenWithShaken:{offsets:[-18,-12,-6,0],kinds:['shaken','six','twelve','six']},
 eighteenWithoutShaken:{offsets:[-12,-6,0],kinds:['six','twelve','six']},
 twelveWithShaken:{offsets:[-12,-6,0],kinds:['twelve','six','shaken']},
 twelveWithoutShaken:{offsets:[-6,0],kinds:['twelve','six']},
 sixWithShaken:{offsets:[-6,0],kinds:['six','shaken']},
 sixWithoutShaken:{offsets:[0],kinds:['six']}
};
export const MENPRO_TEMPLATES=Object.freeze(Object.fromEntries(Object.entries(templates).map(([id,t])=>[id,Object.freeze({offsets:Object.freeze(t.offsets),kinds:Object.freeze(t.kinds)})])));
const assignment=Object.freeze({'54|車検付':'new54','30|車検付':'longWithShaken','24|車検付':'longWithShaken','30|車検なし':'longWithoutShaken','24|車検なし':'longWithoutShaken','18|車検付':'eighteenWithShaken','18|車検なし':'eighteenWithoutShaken','12|車検付':'twelveWithShaken','12|車検なし':'twelveWithoutShaken','6|車検付':'sixWithShaken','6|車検なし':'sixWithoutShaken'});
export function menproTemplateFor(plan){
 if(!plan||!['乗用','EV'].includes(plan.group))return null;
 const expected=`メンテプロパック${plan.period}${plan.group==='EV'?'EV':''}`;
 if(plan.productName!==expected)return null;
 const id=assignment[`${plan.period}|${plan.withShaken}`];return id?{id,...MENPRO_TEMPLATES[id]}:null;
}
const number=m=>Number(m.slice(0,4))*12+Number(m.slice(5,7))-1;
const shift=(month,offset)=>{const n=number(month)+offset;return `${Math.floor(n/12).toString().padStart(4,'0')}-${(n%12+1).toString().padStart(2,'0')}`;};
const labels={six:'6か月点検',twelve:'12か月点検',shaken:'車検'};
export function menproProgress(vehicle,today){
 if(vehicle?.bundledPlan==='あり')return {status:'bundled-excluded',finalMonth:'',reason:'おまとめプランありのため、メンプロは対象外です。'};
 const e=normalizeEnrollment(vehicle?.menproEnrollment),finalMonth=e.endMonth||'';
 if(e.status!=='加入')return {status:'not-enrolled',finalMonth,reason:''};
 const plan=MENPRO_CATALOG.find(p=>p.id===e.planId),template=menproTemplateFor(plan);
 if(!plan)return {status:'unknown-plan',finalMonth,reason:'プラン不明・旧契約・手入力のため、点検構成を確認できず進捗を計算できません。'};
 if(!template)return {status:'unknown-template',finalMonth,reason:`${plan.group}の点検構成が未確認のため、進捗を計算できません。`};
 if(!finalMonth)return {status:'missing-month',finalMonth,reason:'有効期限（最終点検予定年月）を入力すると進捗を計算します。'};
 const currentMonth=normalizeEndMonth(typeof today==='string'?today.slice(0,7):today);
 if(!currentMonth)throw Error('予定計算の現在年月を確認してください');
 const scheduled=template.offsets.map((offset,i)=>({month:shift(finalMonth,offset),kind:template.kinds[i],label:labels[template.kinds[i]],assumedCompleted:shift(finalMonth,offset)<currentMonth}));
 if(scheduled[0].month<'1900-01')return {status:'out-of-range',finalMonth,reason:'計算した開始予定年月が入力範囲外のため、進捗を計算できません。'};
 const remaining=scheduled.filter(s=>!s.assumedCompleted),total=scheduled.length,assumedCompleted=total-remaining.length;
 return {status:'calculated',finalMonth,templateId:template.id,plan,scheduled,remaining,total,assumedCompleted,remainingCount:remaining.length,progressPercent:Math.round(assumedCompleted/total*100),next:remaining[0]||null};
}
