import { format, formatDistanceToNowStrict } from 'date-fns'

/** "3m ago", "2h ago" — compact relative time from an ISO string. */
export function relativeTime(iso: string): string {
  return formatDistanceToNowStrict(new Date(iso), { addSuffix: true })
}

/** Absolute, human date-time, e.g. "Jul 4, 2026 14:03:22". */
export function dateTime(iso: string): string {
  return format(new Date(iso), 'MMM d, yyyy HH:mm:ss')
}

/** "820ms", "3.4s", "1m 12s" from a millisecond duration. */
export function duration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  const m = Math.floor(s / 60)
  const rem = Math.round(s % 60)
  return `${m}m ${rem}s`
}

/** Pretty-print a JSON value for display. */
export function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}
