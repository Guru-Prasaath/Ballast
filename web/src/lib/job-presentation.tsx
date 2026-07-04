import {
  FileBarChart,
  Globe,
  Image,
  Mail,
  Database,
  type LucideIcon,
} from 'lucide-react'
import type { JobType } from '@/types/api'

interface JobTypeMeta {
  label: string
  icon: LucideIcon
}

export const JOB_TYPE_META: Record<JobType, JobTypeMeta> = {
  http_request: { label: 'HTTP request', icon: Globe },
  email: { label: 'Email', icon: Mail },
  data_export: { label: 'Data export', icon: Database },
  image_transform: { label: 'Image transform', icon: Image },
  report: { label: 'Report', icon: FileBarChart },
}

export const JOB_TYPES = Object.keys(JOB_TYPE_META) as JobType[]

export function JobTypeCell({ type }: { type: JobType }) {
  const { label, icon: Icon } = JOB_TYPE_META[type]
  return (
    <span className="inline-flex items-center gap-2">
      <Icon className="size-4 text-muted-foreground" />
      <span>{label}</span>
    </span>
  )
}
