import {escapeHtml as esc} from './core.mjs';
import {enrollmentLabel,normalizeEnrollment} from './menpro-enrollment.mjs';
export const bundledVehicleClass=v=>v?.bundledPlan==='あり'?' bundled-vehicle':'';
export function vehicleTitle(v){
 const name=`<strong>${esc(v.model)}</strong>`;
 const bundle=v.bundledPlan==='あり'?'<span class="bundle-badge" aria-label="おまとめプランあり">おまとめ</span>':'';
 const e=v.menproEnrollment?normalizeEnrollment(v.menproEnrollment):null;
 const enrollment=bundle?(e?.status==='加入'?'<span class="enrollment-badge">加入情報の重複・要確認</span>':''):e?`<span class="enrollment-badge ${e.status==='加入'?'enrolled':''}">${esc(enrollmentLabel(e))}</span>`:'';
 return bundle||enrollment?`<span class="vehicle-name-with-plan">${name}${bundle}${enrollment}</span>`:name;
}

export function vehicleBadges(v){const e=v.menproEnrollment?normalizeEnrollment(v.menproEnrollment):null;if(v.bundledPlan==='あり')return '<span class="bundle-badge">おまとめ</span>'+(e?.status==='加入'?'<span class="enrollment-badge">加入情報の重複・要確認</span>':'');return e?`<span class="enrollment-badge ${e.status==='加入'?'enrolled':''}">${esc(enrollmentLabel(e))}</span>`:'';}
