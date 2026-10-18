import {MENPRO_CATALOG} from './menpro-catalog.mjs';
export const MENPRO_STATUSES=['未確認','未加入','加入'];
export function normalizeEndMonth(value){
 if(value===undefined||value==='')return '';
 if(typeof value!=='string')throw Error('メンプロ有効期限（最終点検予定年月）はYYYY/MMで入力してください');
 const m=value.trim().match(/^(\d{4})[-/](\d{1,2})$/);
 if(!m||+m[1]<1900||+m[1]>2199||+m[2]<1||+m[2]>12)throw Error('メンプロ有効期限（最終点検予定年月）は正しいYYYY/MMで入力してください');
 return `${m[1]}-${m[2].padStart(2,'0')}`;
}
export function normalizeEnrollment(value){
 if(value===undefined||value===null)return {status:'未確認',planId:'',planName:''};
 if(typeof value!=='object'||Array.isArray(value)||!MENPRO_STATUSES.includes(value.status))throw Error('メンプロの加入状況を選択してください');
 const planId=value.planId??'',planName=value.planName??'';
 if(typeof planId!=='string'||planId.length>200||typeof planName!=='string'||planName.length>300)throw Error('メンプロのプラン名は300文字以内で入力してください');
 const endMonth=normalizeEndMonth(value.endMonth);
 return {status:value.status,planId,planName,...(endMonth?{endMonth}:{})};
}
export function enrollmentFromForm(form,previous){
 const old=normalizeEnrollment(previous?.menproEnrollment),choice=form.menproPlan??old.planId;
 const known=MENPRO_CATALOG.find(p=>p.id===choice);
 let planId=choice,planName='';
 if(known)planName=known.label;
 else if(choice==='custom'){planName=(form.menproManualName??old.planName).trim();}
 else if(choice&&choice===old.planId)planName=old.planName;
 else if(choice)throw Error('メンプロのプランを選び直してください');
 return normalizeEnrollment({status:form.menproStatus??old.status,planId,planName,endMonth:form.menproEndMonth??old.endMonth});
}
export function enrollmentLabel(value){
 const e=normalizeEnrollment(value);
 if(e.status!=='加入')return `メンプロ${e.status}`;
 return (e.planName?`加入：${e.planName}`:'メンプロ加入・プラン要確認')+(e.endMonth?` / 最終予定 ${e.endMonth.replace('-','/')}`:'');
}

// Registration-only exclusion; snapshot loading deliberately preserves legacy conflicts.
export function enrollmentRegistrationPatch(form,previous){
 if(form.bundledPlan!=='あり')return {menproEnrollment:enrollmentFromForm(form,previous)};
 if(['menproStatus','menproPlan','menproEndMonth','menproManualName'].some(k=>Object.hasOwn(form,k)))throw Error('おまとめプランありではメンプロの加入・プラン・予定月を設定できません。選択を確認してください');
 const old=normalizeEnrollment(previous?.menproEnrollment),patch={menproEnrollment:{...old,status:'未加入'}};
 if(old.status==='加入'){
  const archive=previous?.menproEnrollmentArchive??[];
  if(!Array.isArray(archive))throw Error('保持中の加入情報を確認してください。元データは変更しません');
  patch.menproEnrollmentArchive=[...archive,{savedAt:new Date().toISOString(),reason:'おまとめプランへの切替前',enrollment:structuredClone(previous.menproEnrollment)}];
 }
 return patch;
}
