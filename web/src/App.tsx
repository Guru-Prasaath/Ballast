import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/app/auth-provider'
import { ProtectedLayout, PublicOnly } from '@/app/route-guards'
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
    <BrowserRouter>
      <AuthProvider>
        <Routes>
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

          <Route element={<ProtectedLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="jobs" element={<JobsPage />} />
            <Route path="queues" element={<QueuesPage />} />
            <Route path="scheduled" element={<ScheduledPage />} />
            <Route path="dead-letter" element={<DeadLetterPage />} />
            <Route path="workers" element={<WorkersPage />} />
            <Route path="advisories" element={<AdvisoriesPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
