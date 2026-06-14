import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'

beforeEach(() => {
  localStorage.clear()
  window.location.hash = ''
})

describe('App', () => {
  it('起動して詳細入力画面が表示される', () => {
    render(<App />)
    expect(screen.getByText('見積条件')).toBeTruthy()
  })

  it('任意保険の初期値が空（未入力プレースホルダ）', () => {
    render(<App />)
    const insurance = screen.getByLabelText(/任意保険（月額）※未入力可/)
    expect((insurance as HTMLInputElement).value).toBe('')
    expect((insurance as HTMLInputElement).placeholder).toBe('未入力')
  })

  it('お客様説明モードへ切り替えると5プラン比較が出る', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: 'お客様説明モード' }))
    expect(screen.getByText('5プラン比較')).toBeTruthy()
    expect(screen.queryByText(/リース/)).toBeNull()
  })

  it('正式見積（手入力）をONにすると初回支払額の入力が現れる', async () => {
    const user = userEvent.setup()
    render(<App />)
    // 既定では非表示。
    expect(screen.queryByLabelText(/初回支払額/)).toBeNull()
    // クレジットの正式見積トグル（複数同名があるため最初の1つを操作）。
    const toggles = screen.getAllByLabelText('正式見積（手入力）を使う')
    await user.click(toggles[0])
    expect(screen.getAllByLabelText(/初回支払額/).length).toBeGreaterThan(0)
  })

  it('ボーナス加算月の選択UIが表示される', () => {
    render(<App />)
    expect(screen.getAllByText('ボーナス加算月').length).toBeGreaterThan(0)
  })

  it('A/B/Cパターンを追加・切替でき、各パターンは独立している', async () => {
    const user = userEvent.setup()
    render(<App />)
    // 初期は1パターン(A)。
    expect(screen.getByRole('tab', { name: /A/ })).toBeTruthy()
    // パターンAに車種名を入力。
    await user.type(screen.getByLabelText('車種名'), 'ノート')
    // 追加 → 新パターン(B)がアクティブで空。
    await user.click(screen.getByRole('button', { name: '＋ 追加' }))
    expect((screen.getByLabelText('車種名') as HTMLInputElement).value).toBe('')
    // Aへ戻すと値が残っている（独立）。
    await user.click(screen.getByRole('tab', { name: /A/ }))
    expect((screen.getByLabelText('車種名') as HTMLInputElement).value).toBe('ノート')
  })

  it('印刷モードで上段比較表・下段維持費が出る', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    await user.click(screen.getByRole('button', { name: '印刷' }))
    expect(container.querySelector('.printsheet__block--top .cmp__table')).toBeTruthy()
    expect(container.querySelector('.printsheet__block--bottom .mtn__table')).toBeTruthy()
  })
})
