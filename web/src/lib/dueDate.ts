import { differenceInCalendarDays, parseISO } from 'date-fns'

export type DueStatus = 'overdue' | 'soon' | 'later'

// Classifies a due date relative to today (browser-local, per the spec).
// Returns null when there is no due date.
export function getDueStatus(due: string | null): DueStatus | null {
  if (!due) return null
  const days = differenceInCalendarDays(parseISO(due), new Date())
  if (days < 0) return 'overdue'
  if (days <= 2) return 'soon'
  return 'later'
}
