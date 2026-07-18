import { useState, type FormEvent } from 'react'
import { BrandMark } from '../../components/BrandMark'

type Props = {
  busy: boolean
  error: string
  onLogin: (password: string) => Promise<void>
}

export function LoginScreen({ busy, error, onLogin }: Props) {
  const [password, setPassword] = useState('')

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    await onLogin(password)
  }

  return (
    <main className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <BrandMark className="login-card__mark" />
        <p className="login-card__product">Car Plan Advisor</p>
        <h1>サインイン</h1>
        <p>パスワードを入力してください</p>
        <label>
          <span>パスワード</span>
          <input
            autoComplete="current-password"
            autoFocus
            disabled={busy}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && <p className="login-card__error" role="alert">{error}</p>}
        <button className="button button--primary" disabled={busy || !password} type="submit">
          {busy ? '確認中…' : 'ログイン'}
        </button>
        <p className="login-card__note">全利用者で共通のパスワードを使用します</p>
      </form>
    </main>
  )
}
