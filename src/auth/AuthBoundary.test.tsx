import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AuthBoundary } from './AuthBoundary'

vi.mock('../components/PwaUpdatePrompt', () => ({
  PwaUpdatePrompt: () => <div data-testid="global-pwa-update" />,
}))

vi.mock('../app/App', () => ({
  default: () => <div>App</div>,
}))

vi.mock('./ClerkAuthApp', () => ({
  default: () => <div>Clerk</div>,
}))

describe('AuthBoundary', () => {
  it('ログイン状態に関係なくPWA更新通知を配置する', () => {
    render(<AuthBoundary />)

    expect(screen.getByTestId('global-pwa-update')).toBeInTheDocument()
  })
})
