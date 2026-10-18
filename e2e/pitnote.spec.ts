import {test,expect,type Page} from '@playwright/test'
import {createBlankScenario, templateFromScenario} from '../src/features/templates/modelTemplates'
const origin='http://127.0.0.1:4190'
const stamp='2026-10-17T12:00:00.000Z'
const fixture={customers:['qa-c1','qa-c2'].map(id=>({id,name:'架空 同名',phone:'',email:'',pref:'不明',sms:'不明',notes:'保存されるメモ'})),vehicles:[['qa-v1','qa-c1','1234'],['qa-v2','qa-c1','5678'],['qa-v3','qa-c2','9012']].map(([id,customerId,numberLast4])=>({id,customerId,numberLast4,model:'ノート',state:'管理中',inspection:'2026-12-01',shaken:'2027-03-01',firstRegistration:'2021-03',bundledPlan:'なし'})),history:[]}
async function seed(page:Page){await page.goto(origin);await expect(page.locator('.brand')).toBeVisible();await page.evaluate(async data=>{
 // @ts-expect-error browser-only static module
 const {openStore}=await import('/local-storage.mjs');const store=await openStore();const row=await store.load();await store.save(data,row?.revision||0);store.close();
},fixture);await page.reload()}
async function open(page:Page,customer='qa-c1',vehicle='qa-v1'){
 await page.locator('nav [data-tab="register"]').click();await page.getByRole('searchbox',{name:'氏名・ふりがな・ナンバー下4桁'}).fill('架空');await page.locator(`[data-search-customer="${customer}"]`).first().click();await page.locator(`[data-carplan="${vehicle}"]`).click();const frame=page.frameLocator('iframe[title="CarPlan 購入・維持費比較"]');await expect(frame.getByRole('heading',{name:'詳細入力'})).toBeVisible();return frame;
}
test('same-origin UI saves and reopens by customer and vehicle IDs without transmitting personal data',async({page},info)=>{
 const network:string[]=[];const errors:string[]=[];page.on('request',r=>network.push(r.url()));page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await seed(page);const frame=await open(page)
 await expect(frame.getByLabel('顧客名',{exact:true})).toHaveValue('架空 同名');await expect(frame.getByLabel('担当者',{exact:true})).toHaveValue('西塚');await expect(frame.getByLabel('担当者',{exact:true})).toHaveAttribute('readonly','')
 await frame.getByLabel('案件名',{exact:true}).fill('架空の比較 A')
 await frame.getByRole('button',{name:'比較を保存',exact:true}).click();await expect(frame.getByRole('status')).toContainText('端末に保存しました')
 await page.frames().find(f=>f.url().includes('/carplan/embed'))!.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:info.outputPath('linked-desktop.png')})
 const saved=await page.evaluate(async()=>{
 // @ts-expect-error browser-only static module
 const {openStore}=await import('/local-storage.mjs');const store=await openStore();const row=await store.load();store.close();return row.data;
 });expect(saved.customers).toEqual(fixture.customers);expect(saved.carplanComparisons).toHaveLength(1);expect(saved.carplanComparisons[0].scenario.customerLink.vehicleId).toBe('qa-v1')
 await frame.getByRole('button',{name:'PITNOTEへ戻る'}).click();await page.locator('#customerDialog .close').click();const other=await open(page,'qa-c2','qa-v3');await expect(other.getByLabel('この顧客・車両の保存済み比較').locator('option')).toHaveCount(1)
 await other.getByRole('button',{name:'PITNOTEへ戻る'}).click();await page.locator('#customerDialog .close').click();const second=await open(page,'qa-c1','qa-v2');await expect(second.getByLabel('この顧客・車両の保存済み比較').locator('option')).toHaveCount(1)
 await second.getByRole('button',{name:'PITNOTEへ戻る'}).click();await page.reload();const reopened=await open(page);await reopened.getByLabel('この顧客・車両の保存済み比較').selectOption(saved.carplanComparisons[0].id);await expect(reopened.getByLabel('案件名',{exact:true})).toHaveValue('架空の比較 A')
 await page.setViewportSize({width:390,height:844});await expect(reopened.getByRole('button',{name:'比較を保存',exact:true})).toBeVisible();await page.frames().find(f=>f.url().includes('/carplan/embed'))!.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:info.outputPath('linked-mobile.png')});expect(await page.frames().find(f=>f.url().includes('/carplan/embed'))!.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 expect(network.every(u=>u.startsWith(origin))).toBe(true);expect(network.every(u=>!u.includes('qa-c1')&&!decodeURIComponent(u).includes('架空'))).toBe(true);expect(errors).toEqual([])
})
test('IndexedDB conflicts, encrypted backups, customer updates and trash preserve comparison snapshots',async({page})=>{
 await seed(page)
 const s=createBlankScenario();s.quote.customerName='架空 同名';s.quote.scenarioName='架空の比較';s.customerLink={customerId:'qa-c1',vehicleId:'qa-v1',customerName:'架空 同名',vehicleName:'ノート',numberLast4:'1234',firstRegistrationMonth:'2021-03',capturedAt:stamp}
 const t=templateFromScenario(s,{id:'qa-t1',name:'架空の設定',model:'ノート',grade:'X FOUR',drive:'4WD'})
 const result=await page.evaluate(async({s,t,stamp})=>{
 // @ts-expect-error browser-only static module
 const {openStore}=await import('/local-storage.mjs');
 // @ts-expect-error browser-only static module
 const {encryptBackup,decryptBackup}=await import('/backup.mjs');
 // @ts-expect-error browser-only static module
 const {comparisonContext,saveComparison,comparisonsFor}=await import('/carplan-records.mjs');
 // @ts-expect-error browser-only static module
 const {trashCustomer,restoreCustomer}=await import('/core.mjs');
 const store=await openStore(),base=await store.load(),context=comparisonContext(base.data,'qa-v1');
 const record={id:'qa-r1',createdAt:stamp,updatedAt:stamp,scenario:s};let {data}=saveComparison(base.data,context,record);data.carplanTemplates=[t]
 const persisted=await store.save(data,base.revision);let conflict=false;try{await store.save(base.data,base.revision)}catch{conflict=true}
 const encrypted=await encryptBackup(data,'local-test-passphrase');const restored=(await decryptBackup(encrypted,'local-test-passphrase')).data
 let wrongPassword=false;try{await decryptBackup(encrypted,'wrong-test-passphrase')}catch{wrongPassword=true}
 data.customers[0].name='架空 更新後';trashCustomer(data,'qa-c1');restoreCustomer(data,'qa-c1')
 const after=await store.save(data,persisted.revision);let crossCustomer=false;try{saveComparison(data,comparisonContext(data,'qa-v3'),record)}catch{crossCustomer=true}
 const contextNow=comparisonContext(data,'qa-v1');const next=structuredClone(record);next.createdAt='2030-01-01T00:00:00Z';next.scenario.customerLink.customerName='変更しようとした氏名';const updated=saveComparison(data,contextNow,next)
 store.close();return {conflict,wrongPassword,crossCustomer,backupSame:JSON.stringify(restored)===JSON.stringify(persisted.data),privateEncryption:!encrypted.includes('架空'),snapshot:after.data.carplanComparisons[0].scenario.customerLink,createdAt:updated.record.createdAt,originalName:updated.record.scenario.customerLink.customerName,other:comparisonsFor(data,'qa-c2','qa-v3').length};
 },{s,t,stamp});expect(result).toMatchObject({conflict:true,wrongPassword:true,crossCustomer:true,backupSame:true,privateEncryption:true,createdAt:stamp,originalName:'架空 同名',other:0});expect(result.snapshot.customerName).toBe('架空 同名')
})
test('foreign-window save messages cannot change records and dirty closes require confirmation',async({page})=>{
 await seed(page);const frame=await open(page);await page.evaluate(()=>window.postMessage({type:'carplan:save',nonce:'fake',record:{}},location.origin));await expect(frame.getByRole('heading',{name:'詳細入力'})).toBeVisible()
 await frame.getByLabel('案件名',{exact:true}).fill('未保存');let confirmations=0;page.on('dialog',async d=>{confirmations++;if(confirmations===1)await d.dismiss();else await d.accept()});await frame.getByRole('button',{name:'PITNOTEへ戻る'}).click();await expect.poll(()=>confirmations).toBe(1);await expect(frame.getByRole('heading',{name:'詳細入力'})).toBeVisible()
 await frame.getByRole('button',{name:'PITNOTEへ戻る'}).click();await expect(page.locator('.carplan-dialog')).toHaveCount(0)
})
test('presets are editable, require exact model and grade, and never mutate a saved comparison',async({page})=>{
 await seed(page);page.on('dialog',d=>d.accept());const frame=await open(page)
 await frame.getByText('設定 · 車種別の概算プラン',{exact:true}).click();await frame.getByRole('button',{name:'概算設定を追加',exact:true}).click()
 await frame.getByLabel('概算設定名',{exact:true}).fill('架空 ノート4WD設定');await frame.getByLabel('車種名',{exact:true}).fill('ノート');await frame.getByLabel('設定グレード',{exact:true}).fill('X FOUR');await frame.getByLabel('車両見積総額（概算）',{exact:true}).fill('3000000')
 await frame.getByRole('button',{name:'概算設定を保存',exact:true}).click();await expect(frame.getByRole('heading',{name:'車種別の概算設定を編集'})).toHaveCount(0)
 await frame.getByLabel('車種を選択',{exact:true}).selectOption('ノート');const grade=frame.getByLabel('グレードを選択',{exact:true});await grade.selectOption({label:'X FOUR · 4WD'});await frame.getByRole('button',{name:'一致した概算設定を読み込む',exact:true}).click()
 await expect(frame.getByLabel('新車見積総額',{exact:true})).toHaveValue('3,000,000');await frame.getByLabel('新車見積総額',{exact:true}).click();await expect(frame.getByLabel('新車見積総額',{exact:true})).toHaveValue('3000000');await frame.getByLabel('新車見積総額',{exact:true}).fill('4000000');await frame.getByRole('button',{name:'比較を保存',exact:true}).click();await expect(frame.getByRole('status')).toContainText('端末に保存しました')
 const saved=await page.evaluate(async()=>{
 // @ts-expect-error browser-only static module
 const {openStore}=await import('/local-storage.mjs');const store=await openStore();const row=await store.load();store.close();return row.data;
 });expect(saved.carplanTemplates[0].terms.vehicle.estimateTotal).toBe(3000000);expect(saved.carplanComparisons[0].scenario.vehicle.estimateTotal).toBe(4000000)
 await frame.getByLabel('車種を選択',{exact:true}).selectOption('ノート オーラ');await grade.selectOption({index:1});await frame.getByRole('button',{name:'この車種で手入力を開始',exact:true}).click();await expect(frame.getByLabel('新車見積総額',{exact:true})).toHaveValue('')
 await frame.getByRole('button',{name:'PITNOTEへ戻る'}).click();await page.reload();const again=await open(page);await again.getByLabel('この顧客・車両の保存済み比較').selectOption(saved.carplanComparisons[0].id);await expect(again.getByLabel('新車見積総額',{exact:true})).toHaveValue('4,000,000')
 await again.getByText('設定 · 車種別の概算プラン',{exact:true}).click();await again.getByLabel('登録済み概算設定',{exact:true}).selectOption(saved.carplanTemplates[0].id);await again.getByRole('button',{name:'設定を編集',exact:true}).click();await again.getByLabel('車両見積総額（概算）',{exact:true}).click();await expect(again.getByLabel('車両見積総額（概算）',{exact:true})).toHaveValue('3000000');await again.getByLabel('車両見積総額（概算）',{exact:true}).fill('5000000');await again.getByRole('button',{name:'概算設定を保存',exact:true}).click();await expect(again.getByRole('heading',{name:'車種別の概算設定を編集'})).toHaveCount(0);await expect(again.getByLabel('新車見積総額',{exact:true})).toHaveValue('4,000,000')
})
test('imported service amounts, payment conditions and tire cycle remain manually editable and persisted',async({page},info)=>{
 await page.setViewportSize({width:1440,height:1200})
 await seed(page);page.on('dialog',d=>d.accept());const frame=await open(page)
 await frame.getByText('PITNOTE の点検・車検料金を使う',{exact:true}).click();await frame.getByLabel('料金マスターの車種',{exact:true}).selectOption('ノート（標準・e-POWER）');await frame.getByRole('checkbox',{name:'この車種・型式への適用と、メンプロ等の別払い料金であることを確認しました'}).check();await frame.getByRole('button',{name:'確認した単価を反映',exact:true}).click()
 await frame.getByRole('button',{name:/維持費 確認済み/}).click();await expect(frame.getByLabel('タイヤ周期',{exact:true})).toHaveValue('3')
 const amounts:{[name:string]:string}={'車検整備料（手修正可）':'81000','車検法定費用等（手入力）':'55000','法定12か月点検':'24000','6か月点検':'16000','夏・冬タイヤ':'180000','タイヤ周期':'5','自動車税':'30500','任意保険':'6000','修理費用':'0'}
 for(const [name,value] of Object.entries(amounts)){const input=frame.getByLabel(name,{exact:true});await input.click();await input.fill('');await input.fill(value);await input.blur()}
 await frame.locator('#section-newMaintenance').screenshot({path:info.outputPath('maintenance-edited.png')})
 await frame.getByRole('button',{name:/支払条件/}).click();const credit=frame.locator('details').filter({has:frame.getByRole('heading',{name:'クレジット条件',exact:true})});await credit.locator('summary').click()
 for(const [name,value] of Object.entries({'頭金':'100000','実質年率':'3.5','初回支払額':'50000','2回目以降月額':'45000','ボーナス月加算額':'100000'})){const input=credit.getByLabel(name,{exact:true});await input.click();await input.fill('');await input.fill(value);await input.blur()}
 await frame.getByRole('button',{name:'比較を保存',exact:true}).click();await expect(frame.getByRole('status')).toContainText('端末に保存しました')
 const record=await page.evaluate(async()=>{
 // @ts-expect-error browser-only static module
 const {openStore}=await import('/local-storage.mjs');const store=await openStore();const row=await store.load();store.close();return row.data.carplanComparisons[0];
 });expect(record.scenario.newMaintenance).toMatchObject({inspectionServiceCost:81000,inspectionLegalCost:55000,legalInspectionCost:24000,sixMonthInspectionCost:16000,tireCost:180000,tireCycleYears:5,annualTax:30500,monthlyInsurance:6000,repairCost:0});expect(record.scenario.credit).toMatchObject({downPayment:100000,annualRate:3.5,firstPayment:50000,monthlyPayment:45000,bonusPayment:100000});expect(record.scenario.newMaintenance.pricingSource.detail).toContain('オイル')
 await frame.getByRole('button',{name:'PITNOTEへ戻る'}).click();await page.reload();const again=await open(page);await again.getByLabel('この顧客・車両の保存済み比較').selectOption(record.id);await again.getByRole('button',{name:/維持費 確認済み/}).click();await expect(again.getByLabel('タイヤ周期',{exact:true})).toHaveValue('5');await expect(again.getByLabel('車検整備料（手修正可）',{exact:true})).toHaveValue('81,000')
})
