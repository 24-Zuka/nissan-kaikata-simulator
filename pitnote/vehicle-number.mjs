// Preserve the old identifier without truncation. New input has its own field.
export function numberValue(v={}){
 if(Object.hasOwn(v,'numberLast4'))return v.numberLast4;
 return typeof v.identifier==='string'&&/^\d{1,4}$/.test(v.identifier)?v.identifier:'';
}
export function numberLabel(v={}){return 'ナンバー下4桁 '+(numberValue(v)||'未登録');}
export function validateNumber(value){
 if(typeof value!=='string'||!/^\d{0,4}$/.test(value))throw Error('ナンバー下4桁は半角数字4桁以内で入力してください（空欄可）。');
 return value;
}
export function saveNumber(old,value){return {identifier:old?.identifier??'',numberLast4:validateNumber(value)};}
