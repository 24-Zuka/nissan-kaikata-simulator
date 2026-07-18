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
    vi.stubGlobal('scrollTo', vi.fn())
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

  it('organizes inputs into four stages and keeps maintenance values separated', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByRole('heading', { name: '詳細入力' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '商談・車両' })).toBeInTheDocument()
    expect(screen.getByLabelText('初度登録年月')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: '次回車検まで' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /維持費 確認済み/ }))
    expect(screen.getByRole('heading', { name: '新車の維持費条件' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '任意保険' })).toHaveValue('')
    expect(screen.getByRole('textbox', { name: '修理費用' })).toHaveValue('')

    await user.click(screen.getByRole('tab', { name: '現在の車' }))
    expect(screen.getByRole('heading', { name: '現在の車の維持費' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '任意保険' })).toHaveValue('')

    await user.click(screen.getByRole('tab', { name: '中古車（補助）' }))
    expect(screen.getByRole('heading', { name: '中古車の維持費条件' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '任意保険' })).toHaveValue('')

    await user.click(screen.getByRole('button', { name: /支払条件/ }))
    expect(screen.getByRole('heading', { name: 'BVC条件' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'おまとめプラン条件' })).toBeInTheDocument()
  })

  it('shows only completed plans in the customer presentation', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: '詳細入力' })
    await user.type(screen.getByRole('textbox', { name: '新車見積総額' }), '5000000')
    await user.click(screen.getByRole('button', { name: 'お客様説明' }))

    expect(await screen.findByRole('heading', { name: '支払と実質負担' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'プラン別実質総額' })).toBeInTheDocument()
    expect(screen.getByText('2プラン比較')).toBeInTheDocument()
    expect(screen.getByText(/未完成のため比較から除外/)).toHaveTextContent('BVC')
    expect(screen.getByText(/未完成のため比較から除外/)).toHaveTextContent('おまとめプラン')
    expect(screen.queryByRole('columnheader', { name: /現状維持/ })).not.toBeInTheDocument()
    expect(screen.getByText('回数・周期の算定条件')).toBeInTheDocument()
    expect(screen.getByText(/本シミュレーションは概算です/)).toBeInTheDocument()
    expect(screen.getByText(/最終的な金額は変動する場合がございます/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '入力へ戻る' })).toBeInTheDocument()
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'auto' })
  })

  it('shows a focused readiness state when fewer than two plans are complete', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: '詳細入力' })
    await user.click(screen.getByRole('button', { name: 'お客様説明' }))

    expect(await screen.findByRole('heading', {
      name: '比較には完成したプランが2件必要です',
    })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'プラン別実質総額' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '入力画面で確認' })).toBeInTheDocument()
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
    const usedPrice = screen.getByRole('textbox', { name: '中古車購入価格' })
    await user.type(usedPrice, '2800000')

    expect(screen.getByText('中古車購入金額')).toBeInTheDocument()
    expect(screen.getByText('現金一括・クレジットは中古車価格で試算中')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /支払条件/ }))
    const omatomeHeading = screen.getByRole('heading', { name: 'おまとめプラン条件' })
    await user.click(omatomeHeading.closest('summary')!)
    expect(screen.getByText('リース料に含まれる維持費')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: '任意保険もリース料に含める' })).toBeInTheDocument()
  })

  it('switches credit and BVC to entered-payment calculation', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: '詳細入力' })
    await user.click(screen.getByRole('button', { name: /支払条件/ }))
    const credit = screen.getByRole('heading', { name: 'クレジット条件' }).closest('details')!
    const bvc = screen.getByRole('heading', { name: 'BVC条件' }).closest('details')!
    await user.click(within(credit).getByRole('heading', { name: 'クレジット条件' }))
    expect(
      within(credit).getByText('金利から自動計算', { selector: '.calculation-note strong' }),
    ).toBeInTheDocument()

    await user.type(within(credit).getByRole('textbox', { name: '2回目以降月額' }), '45000')
    await user.click(within(bvc).getByRole('heading', { name: 'BVC条件' }))
    await user.type(within(bvc).getByRole('textbox', { name: '初回支払額' }), '55000')

    expect(
      within(credit).getByText('入力した支払額で試算', { selector: '.calculation-note strong' }),
    ).toBeInTheDocument()
    expect(within(credit).getByText('初回支払額は、2回目以降月額と同額で計算します。')).toBeInTheDocument()
    expect(within(credit).getByText(/参考値として保存します/)).toBeInTheDocument()
    expect(
      within(bvc).getByText('入力した支払額で試算', { selector: '.calculation-note strong' }),
    ).toBeInTheDocument()
    expect(within(bvc).getByText('手入力で試算するには、2回目以降月額を入力してください。')).toBeInTheDocument()
  })

  it('removes disabled plans from the input flow and comparison count', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: '詳細入力' })
    await user.click(screen.getByRole('button', { name: /比較対象 確認済み/ }))
    const bvcToggle = screen.getByRole('checkbox', { name: /^BVC / })
    await user.click(bvcToggle)
    expect(bvcToggle).not.toBeChecked()

    await user.click(screen.getByRole('button', { name: /支払条件/ }))
    expect(screen.queryByRole('heading', { name: 'BVC条件' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /商談・車両/ }))
    await user.type(screen.getByRole('textbox', { name: '新車見積総額' }), '5000000')
    await user.click(screen.getByRole('button', { name: 'お客様説明' }))

    expect(await screen.findByText('2プラン比較')).toBeInTheDocument()
    expect(screen.queryByRole('row', { name: /BVC/ })).not.toBeInTheDocument()
  })

  it('reveals required errors only after interaction and hides partial amounts', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: '詳細入力' })
    const vehiclePrice = screen.getByLabelText('新車見積総額')
    expect(vehiclePrice).not.toHaveAttribute('aria-invalid')
    await user.click(vehiclePrice)
    await user.tab()
    expect(vehiclePrice).toHaveAttribute('aria-invalid', 'true')

    await user.click(screen.getByRole('button', { name: /支払条件/ }))
    const cash = screen.getByRole('heading', { name: '現金一括条件' }).closest('details')!
    expect(within(cash).getAllByText('要入力').length).toBeGreaterThan(0)
    expect(within(cash).queryByText('0円')).not.toBeInTheDocument()
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
