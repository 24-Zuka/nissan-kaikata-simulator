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
      <section className="login-brand-panel" aria-labelledby="legacy-login-brand-title">
        <div className="login-brand-panel__identity"><BrandMark /><span>Car Plan Advisor</span></div>
        <div>
          <p className="eyebrow">Sales Planning Workspace</p>
          <h1 id="legacy-login-brand-title">商談の比較を、迷わず一つの画面で。</h1>
          <p>支払条件と維持費を整理し、お客様へ伝わる比較資料まで作成します。</p>
        </div>
      </section>
      <section className="login-auth-panel" aria-label="サインイン">
        <form className="login-card" onSubmit={handleSubmit}>
          <span className="login-card__badge">社内アカウント</span>
          <h2>サインイン</h2>
          <p>共通パスワードを入力してください。</p>
          <label>
            <span>パスワード</span>
            <input autoComplete="current-password" autoFocus disabled={busy} type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {error && <p className="login-card__error" role="alert">{error}</p>}
          <button className="button button--primary" disabled={busy || !password} type="submit">{busy ? '確認中…' : 'ログイン'}</button>
          <p className="login-card__note">接続できない場合は管理者へ確認してください。</p>
        </form>
      </section>
    </main>
  )
}
