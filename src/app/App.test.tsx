import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTH_STORAGE_KEY } from '../auth/authClient'
import { CLOUD_MIGRATION_KEY } from '../storage/cloudSync'
import App from './App'

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
    window.location.hash = ''
    localStorage.setItem(AUTH_STORAGE_KEY, 'authenticated')
    localStorage.setItem(CLOUD_MIGRATION_KEY, 'complete')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/api/auth/session')) {
          return new Response(JSON.stringify({ authenticated: true }), { status: 200 })
        }
        if (url.includes('/api/scenarios')) {
          return new Response(JSON.stringify({ scenarios: [] }), { status: 200 })
        }
        return new Response('{}', { status: 200 })
      }),
    )
  })

  it('renders all input sections and keeps insurance fields blank', async () => {
    render(<App />)

    expect(await screen.findByRole('heading', { name: '詳細入力' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'BVC条件' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'おまとめプラン条件' })).toBeInTheDocument()

    const insuranceInputs = screen.getAllByRole('spinbutton', { name: '任意保険' })
    expect(insuranceInputs).toHaveLength(3)
    insuranceInputs.forEach((input) => expect(input).toHaveValue(null))
    expect(screen.getByLabelText('初度登録年月')).toBeInTheDocument()
    expect(screen.queryByRole('spinbutton', { name: '次回車検まで' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '新車の維持費条件' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '中古車の維持費条件' })).toBeInTheDocument()
    expect(screen.getAllByRole('spinbutton', { name: '修理費用' })).toHaveLength(3)
    expect(screen.queryByRole('spinbutton', { name: '修理費用（現状維持）' })).not.toBeInTheDocument()
    expect(screen.queryByRole('spinbutton', { name: '修理費用（新車）' })).not.toBeInTheDocument()
    expect(screen.queryByRole('spinbutton', { name: '修理費用（中古車）' })).not.toBeInTheDocument()
  })

  it('switches to the customer presentation and omits empty status quo', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: '詳細入力' })
    await user.click(screen.getByRole('button', { name: 'お客様説明' }))

    expect(await screen.findByRole('heading', { name: '支払と実質負担' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'プラン別実質総額' })).toBeInTheDocument()
    expect(screen.getByText('4プラン比較')).toBeInTheDocument()
    expect(screen.getAllByText('おまとめプラン').length).toBeGreaterThan(0)
    expect(screen.queryByRole('columnheader', { name: /現状維持/ })).not.toBeInTheDocument()
    const customerMaintenanceCards = document.querySelector(
      '.maintenance-plan-cards',
    ) as HTMLElement
    expect(within(customerMaintenanceCards).queryByText('法定12か月点検')).not.toBeInTheDocument()
    expect(within(customerMaintenanceCards).queryByText('6か月点検')).not.toBeInTheDocument()
    expect(screen.getByText('法定12か月点検')).toBeInTheDocument()
    expect(screen.getByText('6か月点検')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '返却時と買取時' })).not.toBeInTheDocument()
    expect(screen.queryByText('おまとめプラン概要')).not.toBeInTheDocument()
    expect(screen.queryByText('点検')).not.toBeInTheDocument()
    expect(screen.getByText('回数・周期の算定条件')).toBeInTheDocument()
    expect(screen.queryByText('本来発生する維持費')).not.toBeInTheDocument()
    expect(screen.queryByText('リース料に含まれる維持費')).not.toBeInTheDocument()
    expect(screen.queryByText('別途負担が必要な維持費')).not.toBeInTheDocument()
    expect(screen.queryByText('実質負担に反映した維持費')).not.toBeInTheDocument()
    expect(screen.getByText(/本シミュレーションは概算です/)).toBeInTheDocument()
    expect(screen.getByText(/最終的な金額は変動する場合がございます/)).toBeInTheDocument()
    expect(screen.queryByText('※あくまで概算です。')).not.toBeInTheDocument()
  })

  it('does not render prohibited customer-facing phrases', async () => {
    const { container } = render(<App />)
    await screen.findByRole('heading', { name: '詳細入力' })
    const text = container.textContent ?? ''
    const prohibited = [
      ['タイヤ', '交換'].join(''),
      ['絶対', 'おすすめ'].join(''),
      ['これ', '一択'].join(''),
      ['必ず', '得'].join(''),
    ]

    prohibited.forEach((phrase) => expect(text).not.toContain(phrase))
  })

  it('uses the used-car price field and shows the price basis', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: '詳細入力' })
    await user.selectOptions(screen.getByRole('combobox', { name: '車両区分' }), 'used')
    const usedPrice = screen.getByRole('spinbutton', { name: '中古車購入価格' })
    await user.type(usedPrice, '2800000')

    expect(screen.getByText('中古車購入金額')).toBeInTheDocument()
    expect(screen.getByText('現金一括・クレジットは中古車価格で試算中')).toBeInTheDocument()
    expect(screen.getByText('リース料に含まれる維持費')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: '任意保険もリース料に含める' })).toBeInTheDocument()
  })

  it('switches credit and BVC to entered-payment calculation', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: '詳細入力' })
    const credit = screen.getByRole('heading', { name: 'クレジット条件' }).closest('section')!
    const bvc = screen.getByRole('heading', { name: 'BVC条件' }).closest('section')!
    expect(within(credit).getByText('金利から自動計算')).toBeInTheDocument()
    expect(within(bvc).getByText('金利から自動計算')).toBeInTheDocument()

    await user.type(within(credit).getByRole('spinbutton', { name: '2回目以降月額' }), '45000')
    await user.type(within(bvc).getByRole('spinbutton', { name: '初回支払額' }), '55000')

    expect(within(credit).getByText('入力した支払額で試算')).toBeInTheDocument()
    expect(within(credit).getByText('初回支払額は、2回目以降月額と同額で計算します。')).toBeInTheDocument()
    expect(within(credit).getByText(/参考値として保存します/)).toBeInTheDocument()
    expect(within(bvc).getByText('入力した支払額で試算')).toBeInTheDocument()
    expect(within(bvc).getByText('手入力で試算するには、2回目以降月額を入力してください。')).toBeInTheDocument()
  })

  it('removes disabled plans from the input flow and comparison count', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: '詳細入力' })
    await user.click(screen.getByRole('checkbox', { name: 'BVC' }))

    expect(screen.queryByRole('heading', { name: 'BVC条件' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /BVC/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'お客様説明' }))
    expect(await screen.findByText('3プラン比較')).toBeInTheDocument()
    expect(screen.queryByRole('row', { name: /BVC/ })).not.toBeInTheDocument()
  })

  it('hides partial comparison amounts while required inputs are incomplete', async () => {
    render(<App />)

    await screen.findByRole('heading', { name: '詳細入力' })
    expect(screen.getByLabelText('新車見積総額')).toHaveAttribute('aria-invalid', 'true')
    const cash = screen.getByRole('heading', { name: '現金一括条件' }).closest('section')!
    expect(within(cash).getByText('要入力')).toBeInTheDocument()
    expect(within(cash).queryByText('0円')).not.toBeInTheDocument()
    expect(screen.getAllByText('要入力').length).toBeGreaterThan(1)
  })

  it('shows login and an error when authentication fails', async () => {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/api/auth/session')) return new Response('{}', { status: 401 })
        return new Response(JSON.stringify({ message: 'パスワードが違います' }), {
          status: 401,
        })
      }),
    )
    const user = userEvent.setup()
    render(<App />)

    const password = await screen.findByLabelText('パスワード')
    await user.type(password, '0000')
    await user.click(screen.getByRole('button', { name: 'ログイン' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('パスワードが違います')
  })
})
