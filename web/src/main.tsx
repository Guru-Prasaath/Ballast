import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppProviders } from '@/app/providers'
import { USE_MOCKS } from '@/lib/config'

async function bootstrap() {
  // The mock (MSW) backend stands in for the core API unless the app is wired to
  // the real core (VITE_USE_MOCKS=false).
  if (USE_MOCKS) {
    const { enableMocking } = await import('@/mocks/browser')
    await enableMocking()
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppProviders>
        <App />
      </AppProviders>
    </StrictMode>,
  )
}

bootstrap()
