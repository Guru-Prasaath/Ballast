import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/app-layout'
import { OverviewPage } from '@/pages/overview'
import { JobsPage } from '@/pages/jobs'
import { QueuesPage } from '@/pages/queues'
import { PlaceholderPage } from '@/pages/placeholder'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<OverviewPage />} />
          <Route path="jobs" element={<JobsPage />} />
          <Route path="queues" element={<QueuesPage />} />
          <Route
            path="scheduled"
            element={
              <PlaceholderPage
                title="Scheduled"
                description="Delayed and cron jobs waiting to become eligible."
                phase="Phase D"
              />
            }
          />
          <Route
            path="dead-letter"
            element={
              <PlaceholderPage
                title="Dead-letter"
                description="Jobs that exhausted their retries, ready to replay."
                phase="Phase D"
              />
            }
          />
          <Route
            path="workers"
            element={
              <PlaceholderPage
                title="Fleet"
                description="Live workers, heartbeats, leases, and in-flight jobs."
                phase="Phase D"
              />
            }
          />
          <Route
            path="advisories"
            element={
              <PlaceholderPage
                title="AI Advisories"
                description="Recommendations from the advisory loop to heal failures."
                phase="Phase E"
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
