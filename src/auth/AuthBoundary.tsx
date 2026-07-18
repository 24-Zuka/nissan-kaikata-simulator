import { lazy, Suspense } from 'react'
import { PwaUpdatePrompt } from '../components/PwaUpdatePrompt'

const App = lazy(() => import('../app/App'))
const ClerkAuthApp = lazy(() => import('./ClerkAuthApp'))
const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

export function AuthBoundary() {
  return (
    <>
      <PwaUpdatePrompt />
      <Suspense fallback={<div className="auth-loading" role="status">アプリを読み込んでいます…</div>}>
        {publishableKey ? <ClerkAuthApp publishableKey={publishableKey} /> : <App />}
      </Suspense>
    </>
  )
}
