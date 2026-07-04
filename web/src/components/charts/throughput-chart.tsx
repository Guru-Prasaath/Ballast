import { format } from 'date-fns'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ThroughputPoint } from '@/types/api'

const COMPLETED = 'hsl(var(--chart-1))'
const FAILED = 'hsl(var(--state-failed))'

interface TooltipEntry {
  name: string
  value: number
  color: string
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-popover-foreground">
        {label ? format(new Date(label), 'MMM d, HH:mm') : ''}
      </p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="capitalize text-muted-foreground">{entry.name}</span>
          <span className="ml-auto font-medium tabular-nums text-foreground">
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}

export function ThroughputChart({ data }: { data: ThroughputPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="fillCompleted" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COMPLETED} stopOpacity={0.35} />
            <stop offset="100%" stopColor={COMPLETED} stopOpacity={0} />
          </linearGradient>
          <linearGradient id="fillFailed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={FAILED} stopOpacity={0.25} />
            <stop offset="100%" stopColor={FAILED} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          className="stroke-border"
          vertical={false}
        />
        <XAxis
          dataKey="t"
          tickFormatter={(t: string) => format(new Date(t), 'HH:mm')}
          tick={{ fontSize: 11 }}
          className="fill-muted-foreground"
          tickLine={false}
          axisLine={false}
          minTickGap={32}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          className="fill-muted-foreground"
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip content={<ChartTooltip />} />
        <Area
          type="monotone"
          dataKey="completed"
          stroke={COMPLETED}
          strokeWidth={2}
          fill="url(#fillCompleted)"
        />
        <Area
          type="monotone"
          dataKey="failed"
          stroke={FAILED}
          strokeWidth={2}
          fill="url(#fillFailed)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
