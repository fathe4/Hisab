/**
 * Month keys are strings like "2026-09" — used everywhere instead of Date
 * objects to avoid timezone surprises. All helpers are pure string math.
 */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** Returns the month key for a Date, e.g. "2026-09" */
export function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** Current month key */
export function currentMonthKey(): string {
  return toMonthKey(new Date())
}

/** Adds (or subtracts) months from a key. addMonths("2026-01", -1) -> "2025-12" */
export function addMonths(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return toMonthKey(d)
}

/** "2026-09" -> "September 2026" */
export function formatMonth(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return `${MONTH_NAMES[m - 1]} ${y}`
}

/** "2026-09" -> "Sep" (short name for chart axis) */
export function shortMonth(key: string): string {
  const [, m] = key.split('-').map(Number)
  return MONTH_NAMES[m - 1].slice(0, 3)
}

/** First and last day of the month as ISO date strings. */
export function monthRange(key: string): { start: string; end: string } {
  const [y, m] = key.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  const mm = String(m).padStart(2, '0')
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(lastDay).padStart(2, '0')}` }
}

/** Range covering `key` and the N-1 months before it (inclusive). */
export function monthsBackRange(key: string, n: number): { start: string; end: string } {
  const firstKey = addMonths(key, -(n - 1))
  return { start: `${firstKey}-01`, end: monthRange(key).end }
}

/** Today as ISO date string "YYYY-MM-DD" (local time). */
export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** "2026-09-01" -> "Sep 1" */
export function formatDay(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${MONTH_NAMES[m - 1].slice(0, 3)} ${d}`
}

/** "2026-09-01" -> "Sep 1, 2026" */
export function formatDayWithYear(iso: string): string {
  const [y] = iso.split('-')
  return `${formatDay(iso)}, ${y}`
}

/** Month keys for the last n months ending at `key`, oldest first. */
export function lastNMonthKeys(key: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addMonths(key, -(n - 1 - i)))
}
