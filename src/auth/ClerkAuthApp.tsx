import {
  ClerkProvider,
  SignIn,
  useAuth,
  useClerk,
  useOrganization,
  useUser,
} from '@clerk/react'
import { jaJP } from '@clerk/localizations/ja-JP'
import App, { type ExternalAuth } from '../app/App'
import { BrandMark } from '../components/BrandMark'

function AuthenticatedApp() {
  const { isLoaded, isSignedIn, orgId, orgRole, userId } = useAuth()
  const { user } = useUser()
  const { organization } = useOrganization()
  const { signOut } = useClerk()

  if (!isLoaded) {
    return <div className="auth-loading" role="status">ログイン状態を確認しています…</div>
  }
  if (!isSignedIn) {
    return (
      <main className="login-screen">
        <section className="login-brand-panel" aria-labelledby="login-brand-title">
          <div className="login-brand-panel__identity">
            <BrandMark />
            <span>Car Plan Advisor</span>
          </div>
          <div>
            <p className="eyebrow">Sales Planning Workspace</p>
            <h1 id="login-brand-title">商談の比較を、迷わず一つの画面で。</h1>
            <p>支払条件と維持費を同じ基準で整理し、お客様へ伝わる比較資料まで作成します。</p>
          </div>
          <ul>
            <li><span>01</span>商談条件を4ステップで入力</li>
            <li><span>02</span>端末をまたいで見積を同期</li>
            <li><span>03</span>説明画面と印刷資料を自動作成</li>
          </ul>
        </section>
        <section className="login-auth-panel" aria-label="サインイン">
          <div className="login-auth-panel__intro">
            <span>招待制アカウント</span>
            <h2>サインイン</h2>
            <p>登録済みのメールアドレスとパスワードを入力してください。</p>
          </div>
          <div className="clerk-login-shell">
            <SignIn
              transferable={false}
              withSignUp={false}
              appearance={{
                variables: {
                  colorPrimary: 'var(--accent)',
                  colorForeground: 'var(--ink)',
                  colorMutedForeground: 'var(--muted)',
                  colorBackground: 'var(--surface)',
                  colorInput: 'var(--surface-subtle)',
                  colorInputForeground: 'var(--ink)',
                  borderRadius: '12px',
                },
                elements: {
                  rootBox: 'clerk-root',
                  cardBox: 'clerk-card-box',
                  card: 'clerk-card',
                  header: 'clerk-auth-hidden',
                  footer: 'clerk-auth-hidden',
                  socialButtonsBlock: 'clerk-auth-hidden',
                  dividerRow: 'clerk-auth-hidden',
                  alternativeMethodsBlock: 'clerk-auth-hidden',
                  formButtonPrimary: 'clerk-primary-button',
                },
              }}
            />
          </div>
          <p className="login-auth-panel__note">アカウントがない場合は店舗管理者へ招待を依頼してください。</p>
        </section>
      </main>
    )
  }
  if (!orgId) {
    return (
      <main className="login-screen">
        <section className="login-card">
          <h1>店舗組織が未設定です</h1>
          <p>管理者から店舗組織への招待を受けてください。</p>
          <button className="button button--quiet" onClick={() => void signOut()} type="button">
            ログアウト
          </button>
        </section>
      </main>
    )
  }

  const externalAuth: ExternalAuth = {
    userId,
    organizationId: orgId,
    organizationName: organization?.name || '店舗',
    displayName: user?.fullName || user?.primaryEmailAddress?.emailAddress || '担当者',
    role: orgRole === 'org:admin' ? 'admin' : 'member',
    signOut: async () => { await signOut() },
  }
  return <App key={`${orgId}:${userId}`} externalAuth={externalAuth} />
}

export default function ClerkAuthApp({ publishableKey }: { publishableKey: string }) {
  return (
    <ClerkProvider localization={jaJP} publishableKey={publishableKey}>
      <AuthenticatedApp />
    </ClerkProvider>
  )
}
