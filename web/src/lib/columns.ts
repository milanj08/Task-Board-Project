import type { TaskStatus } from '../types'

// Full class names are written as literals so Tailwind's scanner detects them.
// (Never build class names dynamically, e.g. `bg-${x}` — Tailwind won't see them.)
export interface ColumnDef {
  status: TaskStatus
  label: string
  dot: string // accent dot on the header
  tint: string // soft column background
  ink: string // readable header text
  empty: string // playful empty-state line (blank for To do, which has the add card)
}

export const COLUMNS: ColumnDef[] = [
  { status: 'todo', label: 'To do', dot: 'bg-todo', tint: 'bg-todo-tint', ink: 'text-todo-ink', empty: '' },
  { status: 'in_progress', label: 'In progress', dot: 'bg-progress', tint: 'bg-progress-tint', ink: 'text-progress-ink', empty: 'All quiet. Time to get rolling.' },
  { status: 'in_review', label: 'In review', dot: 'bg-review', tint: 'bg-review-tint', ink: 'text-review-ink', empty: 'Nothing to nitpick...yet.' },
  { status: 'done', label: 'Done', dot: 'bg-done', tint: 'bg-done-tint', ink: 'text-done-ink', empty: 'No wins here yet. Go bag one.' },
]

// The next column a task advances to via the card's move button.
// `hover` classes are literals so Tailwind's scanner emits them.
export interface NextMove {
  status: TaskStatus
  label: string
  hover: string
}

export const NEXT_MOVE: Record<TaskStatus, NextMove | null> = {
  todo: { status: 'in_progress', label: 'In progress', hover: 'hover:border-progress hover:bg-progress hover:text-white' },
  in_progress: { status: 'in_review', label: 'In review', hover: 'hover:border-review hover:bg-review hover:text-white' },
  in_review: { status: 'done', label: 'Done', hover: 'hover:border-done hover:bg-done hover:text-white' },
  done: null,
}

// Tint for a card's top bar when hovering the whole card (the click target),
// not just the bar itself — group-hover so it still reads as a unit.
export const HOVER_TINT: Record<TaskStatus, string> = {
  todo: 'group-hover:bg-todo/50',
  in_progress: 'group-hover:bg-progress/50',
  in_review: 'group-hover:bg-review/50',
  done: 'group-hover:bg-done/50',
}
