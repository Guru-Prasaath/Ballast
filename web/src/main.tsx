import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AppProviders } from '@/app/providers'

async function bootstrap() {
  // The mock (MSW) backend stands in for the core API during frontend-first
  // development. Guarded so a future production build can skip it.
  if (import.meta.env.DEV) {
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
