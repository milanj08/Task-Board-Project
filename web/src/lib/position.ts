import { arrayMove } from '@dnd-kit/sortable'
import type { TaskStatus, TaskWithAssignees } from '../types'

// Every position lives on one clock: seconds since epoch, matching schema.sql's
// `position` column default (`extract(epoch from clock_timestamp())`). Keeping
// one unit is what lets positions from the DB default, task creation, and
// drag-reorder all compare correctly against each other.
function now(): number {
  return Date.now() / 1000
}

// Positions are doubles, so dropping into the same gap over and over halves it
// until there is nothing left to halve — after about fifty tries the midpoint
// comes back equal to one of the endpoints. Handing the card that value would
// give it the same position as its neighbour, and the board sorts on position
// alone, so the two would swap places at random on every load. Return null
// there and let the caller refuse the move instead.
function computeBetween(prev?: number, next?: number): number | null {
  if (prev != null && next != null) {
    const mid = (prev + next) / 2
    return mid === prev || mid === next ? null : mid
  }
  if (prev != null) return prev + 1
  if (next != null) return next - 1
  return now()
}

// Position before every existing task, so a newly created task sorts to the top.
export function computeTop(tasks: TaskWithAssignees[]): number {
  const positions = tasks.map((t) => t.position)
  return positions.length ? Math.min(...positions) - 1 : now()
}

// Position after every task in `status` (excluding `excludeId`) — appends to the
// bottom of that column. Used when a status changes without a specific drop
// target, e.g. the card's "move forward" button.
export function computeEnd(tasks: TaskWithAssignees[], status: TaskStatus, excludeId?: string): number {
  const positions = tasks
    .filter((t) => t.status === status && t.id !== excludeId)
    .map((t) => t.position)
  return positions.length ? Math.max(...positions) + 1 : now()
}

// Given a drop target, work out the task's new status + fractional position.
export function computeMove(
  tasks: TaskWithAssignees[],
  active: TaskWithAssignees,
  over: { id: string; type?: string },
): { status: TaskStatus; position: number } | null {
  const byPos = (a: TaskWithAssignees, b: TaskWithAssignees) => a.position - b.position

  if (over.type === 'column') {
    const status = over.id as TaskStatus
    return { status, position: computeEnd(tasks, status, active.id) }
  }

  const overTask = tasks.find((t) => t.id === over.id)
  if (!overTask || overTask.id === active.id) return null
  const status = overTask.status

  if (status === active.status) {
    const ordered = tasks.filter((t) => t.status === status).sort(byPos)
    const moved = arrayMove(
      ordered,
      ordered.findIndex((t) => t.id === active.id),
      ordered.findIndex((t) => t.id === over.id),
    )
    const idx = moved.findIndex((t) => t.id === active.id)
    const position = computeBetween(moved[idx - 1]?.position, moved[idx + 1]?.position)
    return position == null ? null : { status, position }
  }

  const others = tasks.filter((t) => t.status === status).sort(byPos)
  const overIndex = others.findIndex((t) => t.id === over.id)
  const position = computeBetween(others[overIndex - 1]?.position, others[overIndex]?.position)
  return position == null ? null : { status, position }
}
