import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/app/auth-provider'
import { ProtectedLayout, PublicOnly } from '@/app/route-guards'
import { LandingPage } from '@/pages/landing'
import { LoginPage } from '@/pages/login'
import { SignupPage } from '@/pages/signup'
import { OverviewPage } from '@/pages/overview'
import { JobsPage } from '@/pages/jobs'
import { QueuesPage } from '@/pages/queues'
import { ScheduledPage } from '@/pages/scheduled'
import { DeadLetterPage } from '@/pages/dead-letter'
import { WorkersPage } from '@/pages/workers'
import { AdvisoriesPage } from '@/pages/advisories'

export default function App() {
  return (
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route
            path="/login"
            element={
              <PublicOnly>
                <LoginPage />
              </PublicOnly>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicOnly>
                <SignupPage />
              </PublicOnly>
            }
          />

          <Route path="/app" element={<ProtectedLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="jobs" element={<JobsPage />} />
            <Route path="queues" element={<QueuesPage />} />
            <Route path="scheduled" element={<ScheduledPage />} />
            <Route path="dead-letter" element={<DeadLetterPage />} />
            <Route path="workers" element={<WorkersPage />} />
            <Route path="advisories" element={<AdvisoriesPage />} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
