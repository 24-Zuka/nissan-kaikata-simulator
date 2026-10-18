import {commercialColumns} from './commercial.mjs';
import {validDate} from './core.mjs';
import {PRICE_DATA as P} from './price-data.mjs';
export const SERVICES=[['six','6か月点検'],['three','3か月点検（運送事業用）'],['one','1か月点検（運送事業用）'],['twelve','12か月点検'],['shaken','車検'],['tires','タイヤ作業'],['menpro','メンプロ料金']];
export const ESTIMATE_CLASSES={inspection:['未確認','軽商用','Sバン','Mバン','LLバン','軽','SS','S','M','L','LL','LLL','GT-R・その他（個別確認）'],tire:['未確認','軽','SS・S','M','L・LL','トラック・マイクロ（個別確認）'],menpro:['未確認','軽商用','ボンネット','1BOX','トラック2t未満','軽','S','M','L','専用','その他（個別確認）'],oil:['未確認','軽・コンパクト','M','L・1BOX・SUV','エクストレイルＤ','バネット・キャラバン','アトラス','例外車種（個別確認）']};
export const MENPRO_GROUPS=['未確認','商用','軽商用','乗用','EV','NISMO','GT-R','クリーンディーゼル','V37ターボ','軽商用・商用・その他（個別確認）'];
export const PLANS=['未確認','ベーシック','ライト','タイヤシーズン交換付き','ウィンドウ撥水・CF付き'];
export const defaultEstimate=()=>({service:'six',inspectionClass:'未確認',tireClass:'未確認',menproClass:'未確認',oilClass:'未確認',oil:'未確認',element:'未確認',basis:'表の合計項目',ageCheck:'なし',severe:'あり',diagnosisSix:'なし',diagnosisTwelve:'あり',diagnosisShaken:'あり',steam:'あり',rust:'あり',brake:'あり',serviceDate:'',tireWork:'未確認',quantity:'4',tpms:'未確認',priceMethod:'未確認',membership:'未確認',coverage:'未確認',plan:'未確認',period:'未確認',withShaken:'未確認',menproGroup:'未確認',eligibility:'未確認',oilEligibility:'未確認'});
export function estimateAssessment(d){if(P.available===false)return {status:'料金マスター未登録',total:null,subtotal:null,items:[],reasons:['会社確認済みの料金ファイルを端末に取り込んでください。'],notes:[],lowerBound:false};
 if(!SERVICES.some(([k])=>k===d.service))throw Error('作業を選択してください');
 if(d.serviceDate&&!validDate(d.serviceDate))throw Error('入庫予定日を正しいYYYY-MM-DDで入力してください');
 const reference=d.referenceOnly===true;
 const reasons=[],notes=[],items=[];let lowerBound=false;
 const block=s=>reasons.push(s),note=s=>notes.push(s);
 const add=(label,key,cell,{tax=false,qty=1,sheet}={})=>{const value=P[key]?.cells[cell];if(typeof value!=='number'||!Number.isFinite(value)||value<=0){block(label+'の価格根拠は確認が必要です。');return;}
 const source=key==='tireWork'?'tire':key==='businessInspection'?'inspection':key;items.push({label,unit:tax?Math.round(value*110/100):value,quantity:qty,amount:(tax?Math.round(value*110/100):value)*qty,source:P.sources[source],sheet:sheet||P[key].sheet,cell,tax:tax?'税別料金 × 原表税率1.1':'税込掲載額（再課税なし）'});};
 if(reference)note('未加入・通常単品を前提にした参考額です。会員資格・加入済み作業の請求可否を確認した金額ではありません。');
 const yesno=(key,label)=>{if(!['あり','なし'].includes(d[key]))block(label+'の有無を確認してください。');return d[key]==='あり';};
 const clkey=d.service==='tires'?'tire':d.service==='menpro'?'menpro':'inspection';
 if(!ESTIMATE_CLASSES[clkey].includes(d[clkey+'Class']))throw Error('作業別の料金クラスを選択してください');
 if(d.service!=='menpro'){
  if(d.coverage==='今回作業を含む')block('加入済みプランに含まれる作業の別料金加算を止めています。包含資料の確認が必要です。');
  else if(d.coverage==='包含未確認')block('加入済みプランの包含範囲が未確認のため計算を止めています。');
  else if(!['未加入','今回作業は別料金'].includes(d.coverage))block('メンプロ加入・今回作業の包含範囲を確認してください。');
  if(d.coverage==='未加入'&&['メンプロ（ライト以外）','メンプロライト'].includes(d.membership))block('未加入とメンプロ会員の条件が矛盾しています。');
 }
 if(['one','three','six','twelve','shaken'].includes(d.service)){
  const commercial=d.commercial===true||d.vehicleVariant==='商用・事業用（料金要確認）',cc=commercialColumns(d);
  if(commercial&&!cc)block('商用車の用途と適用料金区分を登録画面で確認してください。乗用料金は適用しません。');
  const col=commercial?cc?.col:{軽:'C',SS:'D',S:'E',M:'F',L:'G',LL:'H',LLL:'I'}[d.inspectionClass];
  if(!col)block('点検・車検の掲載区分が未確定です。');
  const row=(r,label)=>{if(col)add(label,cc?.key||'inspection',col+r,{tax:true});};
  note(commercial?'2024.10の貨物適用欄を用途別に参照。周期は自動計算せず、実期限を入力してください。':'2024.10表を現行として採用。自家用乗用の料金です。選択項目は変更できます。');
  if(commercial&&d.oilClass==='未確認')note('オイル料金の適用区分が未確定です。オイルなしの整備小計を表示し、油代は含めません。');
  if(d.service==='six'){
   if(cc?.business)block('運送事業用表には6か月料金がありません。3か月・1か月等の掲載作業を確認してください。');
   else if(cc?.cargo){row(37,'法定6か月 基本点検');row(38,'距離項目');if(yesno('diagnosisSix','コンピュータ診断'))row(39,'コンピュータ診断');if(d.ageCheck==='あり')block('貨物6か月の経年点検追加額は未掲載です。');}
   else {row(42,'安心6 基本点検');if(yesno('ageCheck','経年・長距離点検'))row(43,'経年・長距離点検');if(yesno('diagnosisSix','コンピュータ診断'))row(44,'コンピュータ診断');note('安心6の表合計は基本点検のみ。経年点検・診断を自動加算しません。');}
  }else if(['one','three'].includes(d.service)){
   if(!cc?.business)block('1か月・3か月の掲載作業は運送事業用表のみです。');
   else if(d.service==='three'){row(33,'法定3か月 基本点検');row(34,'距離項目');if(yesno('diagnosisSix','コンピュータ診断'))row(35,'コンピュータ診断');}
   else {row(38,'法定1か月 基本点検');if(yesno('diagnosisSix','コンピュータ診断'))row(39,'コンピュータ診断');}
  }else if(d.service==='twelve'){
   const base=cc?.business?27:29;
   row(base,'法定12か月 基本点検');row(base+1,'日常・距離項目');
   if(!cc?.cargo&&yesno('severe','シビアコンディション'))row(base+2,'シビアコンディション');
   else if(cc?.cargo&&d.severe==='あり')block('貨物のシビアコンディション加算は原表に掲載がありません。');
   if(yesno('diagnosisTwelve','コンピュータ診断'))row(base+3,'コンピュータ診断');
  }else{
   const business=cc?.business;
   for(const [r,label]of [[11,'車検基本項目'],[12,'日常・距離項目'],[13,'保安確認検査料'],[business?18:20,'車検更新手続料'],[business?20:22,'ブレーキメンテナンスキット']])row(r,label);
   if(yesno('steam','スチーム洗浄'))row(14,'下廻りスチーム洗浄');
   if(yesno('rust','錆止め')){row(15,'下廻り錆止め 工賃');row(business?21:23,'錆止めパスター 部品');}
   if(yesno('brake','ブレーキ油')){row(16,'ブレーキ油 交換工賃');row(business?19:21,'ブレーキ油 部品');}
   if(yesno('diagnosisShaken','コンピュータ診断'))row(17,'コンピュータ診断');
   note('法定費用・諸費用・追加整備は未算入。車検総額ではありません。更新手続料は上の小計に1回だけ含みます。');
  }
  if(['six','twelve'].includes(d.service)){
   const oil=yesno('oil','オイル交換'),element=d.service==='twelve'?yesno('element','エレメント交換'):false;
   if(!oil&&element)block('エレメント単独の価格は未設定です。セット差額から推測しません。');
   if(oil){
    if(d.vehicleVariant==='EV（自家用乗用）')block('EVにエンジンオイル交換を加算できません。作業条件を確認してください。');
    if(d.serviceDate&&d.serviceDate<'2026-10-01')block('オイル料金は2026年10月版です。対象日以前の料金は未確認です。');
    if(d.oilEligibility!=='個人・例外対象外を確認'&&!(reference&&d.oilEligibility==='未確認'))block('オイル掲載料金は個人のお客様限定です。GT-R・V37ターボ・400R・他メーカー等の例外対象外を確認してください。');
    const r={'軽・コンパクト':5,M:6,'L・1BOX・SUV':7,'エクストレイルＤ':12,'バネット・キャラバン':13,'アトラス':14}[d.oilClass];
    if(!r)block('オイル料金クラスを確認してください。例外車種は個別確認です。');
    const n=['標準','特別価格','会員'].indexOf(d.priceMethod);if(n<0)block('オイルの料金方式を選択してください。');
    if(d.priceMethod==='会員'&&!['日産カード','メンプロ（ライト以外）'].includes(d.membership))block('会員オイル価格の適用条件が未確認です。メンプロライトは対象外です（日産カード資格は別途確認）。');
    if(r&&n>=0)add(element?'オイル＋エレメント パッケージ':'オイル交換 パッケージ','oil',(element?'EFG':'BCD')[n]+r);
    note('オイル掲示価格は技術料・消費税込み。油量や工賃・税を重ねて加算しません。');
   }
  }
 }else if(d.service==='tires'){
  if(d.serviceDate&&d.serviceDate<'2026-10-01')block('タイヤ料金は2026年10月1日以降の表です。対象日以前の料金は未確認です。');
  const index=['軽','SS・S','M','L・LL'].indexOf(d.tireClass);
  const wheel=d.tireWork==='ホイール付き履き替え';
  if(d.priceMethod==='期間限定'){
   if(!d.serviceDate)block('期間限定料金には入庫予定日の確認が必要です。');
   else if(d.serviceDate<'2026-10-01'||d.serviceDate>'2026-10-31')block('2026年10月の期間限定料金の対象日外です。');
  }
  if(wheel){
   if(d.priceMethod==='会員'){
    if(!['メンプロ（ライト以外）','メンプロライト'].includes(d.membership))block('タイヤ会員価格はメンプロ会員資格の確認が必要です。日産カードのみでは適用しません。');
    const cell={軽:'A44',S:'D44',M:'G44',L:'G44'}[d.menproClass];if(!cell)block('タイヤ会員料金に使うメンプロ車両クラスを確認してください。');else add('ホイール付き履き替え 1台（メンプロ会員）','tire',cell);
   }else if(['通常','期間限定'].includes(d.priceMethod)){
    if(index<0)block('タイヤ料金クラスを確認してください。トラック・例外車種は個別確認です。');
    else add('ホイール付き履き替え 1台','tire',(d.priceMethod==='通常'?'I':'K')+[14,18,24,28][index]);
   }else block('タイヤ料金方式を選択してください。');
  }else if(['組替','バランス調整'].includes(d.tireWork)){
   if(d.priceMethod!=='通常')block('組替・バランスの期間限定/会員価格は設定されていません。通常を選択してください。');
   const qty=Number(d.quantity);if(!Number.isInteger(qty)||qty<1||qty>6)block('作業本数は1〜6本で入力してください。');
   if(index<0)block('タイヤ料金クラスを確認してください。');
   if(index>=0&&Number.isInteger(qty)&&qty>=1&&qty<=6){const cell=d.tireWork==='組替'?'DEFG'[index]+'7':'D8';const raw=P.tireWork.cells[cell];const unit=Number(raw.replace(/[^0-9]/g,''));items.push({label:d.tireWork+'（1本あたり・下限）',unit,quantity:qty,amount:unit*qty,source:P.sources.tire,sheet:P.tireWork.sheet,cell,tax:'税込掲載額・下限'});}
   lowerBound=true;note('組替・バランスは本数単位の下限額。脱着料・追加作業・廃タイヤ処理等は別途確認が必要です。');
  }else block('タイヤ作業の範囲を確認してください。');
  if(yesno('tpms','空気圧センサー登録')){items.push({label:'空気圧センサー登録 1台',unit:P.tpmsUnit,quantity:1,amount:P.tpmsUnit,source:P.sources.tire,sheet:'2026下期掲示物',cell:'A34',tax:'税込掲載額'});}
  note('通常/期間限定/会員は1方式のみ。車種・タイヤ等による追加料金、納引費用は別途。保管の取扱いは会社へ確認してください。');
 }else{
  if(d.serviceDate&&d.serviceDate<'2026-10-01')block('メンプロは2026年10月版です。対象日以前の料金は未確認です。');
  if(d.eligibility!=='加入対象を確認'&&!(reference&&d.eligibility==='未確認'))block('メンプロの用途・車両・申込者などの加入対象を確認してください。旧クラス一覧での判定はしません。');
  if(!MENPRO_GROUPS.includes(d.menproGroup))throw Error('メンプロ商品区分を確認してください');
  if(d.commercial){
   if(!['private','business'].includes(d.commercialUse))block('メンプロの貨物用途を登録画面で確認してください。');
   if(d.menproGroup==='商用'&&d.commercialUse==='business')block('原表で普通・小型の運送事業用貨物はメンプロ対象外です。');
   if(d.menproGroup==='商用'&&d.withShaken!=='あり')block('商用車Sは車検付きのみ掲載されています。');
   note('商用車Sは積載2t以上・0/2/8/9ナンバー・営業車・レンタカー等が対象外。軽貨物の運送事業用は軽商用商品を参照。加入資格は別途確認。');
  }
  const r=P.menproRows[[d.menproGroup,d.period,d.menproClass].join('|')],pi=PLANS.indexOf(d.plan)-1;
  if(!r)block('商品区分・期間・メンプロクラスの組合せを確認してください。専用商品は専用クラスを選択します。');
  if(pi<0)block('メンプロのプランを選択してください。');
  const withShaken=yesno('withShaken','車検付き');const cell=r&&pi>=0?'IJKLMNOP'[pi*2+(withShaken?0:1)]+r:null;
  if(['M100','N100','M101','N101'].includes(cell))block('メンプロ原表の疑義セル '+cell+' は要確認です。補正・自動見積はしません。');
  else if(cell&&['あり','なし'].includes(d.withShaken))add('メンプロ 掲載契約料金','menpro',cell);
  note('掲載契約料金は税込として確認済み。包含作業・回数は未確認です。今回の点検・車検等の料金から差し引きません。車検付きでも法定費用等の包含は別途確認してください。');
  if(['42','54'].includes(d.period))note(d.period+'か月は新車時のプランです。加入時期も確認してください。');
 }
 // Never publish an apparently complete quote when selected conditions are unresolved.
 const subtotal=reasons.length||!items.length?null:items.reduce((s,i)=>s+i.amount,0);
 const total=subtotal===null||['shaken','menpro'].includes(d.service)||lowerBound?null:subtotal;
 return {status:subtotal===null?'確認が必要':d.service==='menpro'?'掲載契約料金（包含は要確認）':d.service==='shaken'?'整備小計（法定費用等は別）':lowerBound?'作業小計の目安（下限）':'選択作業の概算',total,subtotal,items:subtotal===null?[]:items,reasons,notes,lowerBound};
}
