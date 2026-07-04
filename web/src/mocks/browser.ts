import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

export const worker = setupWorker(...handlers)

/** Start MSW in the browser. Called from main.tsx only in development. */
export async function enableMocking() {
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: true,
  })
}
