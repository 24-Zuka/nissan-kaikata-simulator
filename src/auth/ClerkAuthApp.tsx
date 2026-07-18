import {
  ClerkProvider,
  SignIn,
  useAuth,
  useClerk,
  useOrganization,
  useUser,
} from '@clerk/react'
import App, { type ExternalAuth } from '../app/App'

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
        <div className="clerk-login-shell">
          <SignIn
            withSignUp={false}
            appearance={{
              elements: {
                footerAction: 'clerk-invite-only-footer',
                socialButtonsBlock: 'clerk-auth-hidden',
                dividerRow: 'clerk-auth-hidden',
                alternativeMethodsBlock: 'clerk-auth-hidden',
              },
            }}
          />
        </div>
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
  return <App externalAuth={externalAuth} />
}

export default function ClerkAuthApp({ publishableKey }: { publishableKey: string }) {
  return (
    <ClerkProvider publishableKey={publishableKey}>
      <AuthenticatedApp />
    </ClerkProvider>
  )
}
