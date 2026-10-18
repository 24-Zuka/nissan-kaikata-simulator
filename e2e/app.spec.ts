import { expect, test, type Page } from '@playwright/test'
import { createInitialScenario } from '../src/domain/defaults'

async function mockAuthenticatedApi(page: Page) {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ json: { authenticated: true } })
  })
  await page.route('**/api/scenarios**', async (route) => {
    await route.fulfill({ json: { scenarios: [], nextCursor: null } })
  })
  await page.route('**/api/members', async (route) => {
    await route.fulfill({ json: { members: [] } })
  })
}

async function openAuthenticatedApp(page: Page, path = '/') {
  await mockAuthenticatedApi(page)
  await page.goto(path)
  await expect(page.getByRole('heading', { name: '詳細入力' })).toBeVisible()
}

test('入力から完成プランのみをお客様説明に表示する', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const legacy = Buffer.from(JSON.stringify(createInitialScenario())).toString('base64url')
  await openAuthenticatedApp(page, `/#share=${legacy}`)

  await page.getByLabel('新車見積総額', { exact: true }).fill('5000000')
  await page.getByRole('button', { name: 'お客様説明', exact: true }).click()

  await expect(page.getByRole('heading', { name: '支払と実質負担' })).toBeVisible()
  await expect(page.getByText('2プラン比較', { exact: true })).toBeVisible()
  await expect(page.getByText('未完成のため比較から除外: BVC、おまとめプラン')).toBeVisible()
  await expect(page.getByRole('region', { name: 'プラン別実質総額' })).toBeVisible()

  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    content: document.documentElement.scrollWidth,
  }))
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport)
})

test('390pxで入力ステップと固定操作を表示する', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openAuthenticatedApp(page)

  await expect(page.getByRole('tablist', { name: '入力ステップ' })).toBeVisible()
  await expect(page.getByLabel('入力操作')).toBeVisible()
  await expect(page.getByRole('button', { name: '保存', exact: true })).toBeVisible()

  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    content: document.documentElement.scrollWidth,
  }))
  expect(dimensions).toEqual({ viewport: 390, content: 390 })
})

test('834pxでフォーム優先の1カラムに切り替える', async ({ page }) => {
  await page.setViewportSize({ width: 834, height: 1112 })
  await openAuthenticatedApp(page)

  await expect(page.getByRole('tablist', { name: '入力ステップ' })).toBeVisible()
  await expect(page.getByLabel('入力操作')).toBeVisible()
  await expect(page.locator('main.input-layout > aside.quick-results')).toBeHidden()

  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    content: document.documentElement.scrollWidth,
  }))
  expect(dimensions).toEqual({ viewport: 834, content: 834 })
})

test('比較できるプランが2件未満なら入力へ戻す', async ({ page }) => {
  await openAuthenticatedApp(page)

  await page.getByRole('button', { name: 'お客様説明', exact: true }).click()

  await expect(page.getByRole('heading', {
    name: '比較には完成したプランが2件必要です',
  })).toBeVisible()
  await expect(page.getByRole('button', { name: '入力画面で確認' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'プラン別実質総額' })).toHaveCount(0)
})

test('5プランの印刷がA4横1ページに収まる', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const scenario = createInitialScenario()
  scenario.quote.carName = 'セレナ'
  scenario.quote.grade = 'e-POWER'
  scenario.vehicle.estimateTotal = 5_000_000
  scenario.currentCar.originalPurchasePrice = 2_500_000
  scenario.currentCar.firstRegistrationMonth = '2020-01'
  scenario.bvc.residualValue = 2_000_000
  scenario.omatome.firstPayment = 70_000
  scenario.omatome.monthlyPayment = 65_000
  scenario.omatome.finalPayment = 1_800_000
  const sharedScenario = Buffer.from(JSON.stringify(scenario)).toString('base64url')

  await mockAuthenticatedApi(page)
  await page.goto(`/?mode=presentation#share=${sharedScenario}`)
  await expect(page.getByText('5プラン比較', { exact: true })).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('five-plan-screen.png'), fullPage: true })

  await page.emulateMedia({ media: 'print' })
  const pdf = await page.pdf({
    format: 'A4',
    landscape: true,
    printBackground: true,
    path: testInfo.outputPath('five-plan-comparison.pdf'),
  })
  const pageCount = (pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length
  expect(pageCount).toBe(1)
})

test('取り込んだ車検法定費用と西塚を含む新規比較を1ページで印刷する',async({page},testInfo)=>{
 const scenario=createInitialScenario();scenario.strictInput=true;scenario.quote.amountStatus='estimate';scenario.vehicle.estimateTotal=3000000;scenario.vehicle.tradeIn=0;scenario.credit.downPayment=0;scenario.credit.bonusPayment=0
 Object.assign(scenario.newMaintenance,{monthlyInsurance:0,repairCost:0,tireCycleYears:3,inspectionServiceCost:70000,inspectionLegalCost:55000,pricingSource:{model:'架空テストの料金',masterVersion:'テスト用の原表版',codes:'TEST',appliedAt:'2026-10-17T12:00:00.000Z',detail:'{}'}})
 scenario.comparison.enabledPlans.bvc=false;scenario.comparison.enabledPlans.omatome=false
 const shared=Buffer.from(JSON.stringify(scenario)).toString('base64url');await mockAuthenticatedApi(page);await page.goto(`/?mode=presentation#share=${shared}`)
 await expect(page.getByText('2プラン比較',{exact:true})).toBeVisible();await expect(page.getByText('西塚',{exact:true})).toBeVisible();await expect(page.locator('.pricing-snapshot')).toContainText('55,000円')
 await page.emulateMedia({media:'print'});
 const pdf=await page.pdf({format:'A4',landscape:true,printBackground:true,path:testInfo.outputPath('source-snapshot-comparison.pdf')});expect((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)??[]).length).toBe(1)
})
