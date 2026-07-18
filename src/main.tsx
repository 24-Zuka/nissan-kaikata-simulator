import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthBoundary } from './auth/AuthBoundary'
import { applyTheme, getInitialTheme } from './theme/theme'
import './app/global.css'

applyTheme(getInitialTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
      <AuthBoundary />
  </StrictMode>,
)
