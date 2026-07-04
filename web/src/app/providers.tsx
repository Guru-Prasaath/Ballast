import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeProvider } from '@/components/theme-provider'
import { ToasterProvider } from '@/components/toaster'
import { LiveProvider } from '@/app/live-provider'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToasterProvider>
          <LiveProvider>
            <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
          </LiveProvider>
        </ToasterProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
