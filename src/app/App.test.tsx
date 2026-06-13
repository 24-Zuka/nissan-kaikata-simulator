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

  it('印刷モードで上段比較表・下段維持費が出る', async () => {
    const user = userEvent.setup()
    const { container } = render(<App />)
    await user.click(screen.getByRole('button', { name: '印刷' }))
    expect(container.querySelector('.printsheet__block--top .cmp__table')).toBeTruthy()
    expect(container.querySelector('.printsheet__block--bottom .mtn__table')).toBeTruthy()
  })
})
