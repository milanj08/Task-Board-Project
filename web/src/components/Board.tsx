import { useRef } from 'react'
import { useDndMonitor } from '@dnd-kit/core'
import { COLUMNS } from '../lib/columns'
import { useTasks } from '../hooks/useTasks'
import { Column } from './Column'

// While a member/team is being dragged toward a task, the board never changes
// which column is in view — reaching a task means it has to already be on
// screen. This also protects dnd-kit's own built-in autoScroll (used for
// task-card drags between columns) from fighting CSS scroll-snap, which
// corrects incremental scrollLeft writes back toward the nearest snap point.
function useSuspendSnapDuringDrag(containerRef: React.RefObject<HTMLDivElement | null>) {
  useDndMonitor({
    onDragStart() {
      if (containerRef.current) containerRef.current.style.scrollSnapType = 'none'
    },
    onDragEnd() {
      if (containerRef.current) containerRef.current.style.scrollSnapType = ''
    },
    onDragCancel() {
      if (containerRef.current) containerRef.current.style.scrollSnapType = ''
    },
  })
}

// Column width is min-w-[300px] (see Column.tsx); half of that (150px) is baked
// into this padding so a snapped column sits dead-center on mobile, with a
// deliberate sliver of its neighbors peeking in on both sides as a swipe hint.
// md:px-6 drops back to plain padding once multiple columns are visible at once
// and snapping is disabled.
const SCROLL_CLASSES =
  'flex h-full items-start gap-4 overflow-x-auto snap-x snap-mandatory px-[calc(50vw-150px)] py-6 md:snap-none md:px-6'

function BoardSkeleton() {
  return (
    <div className={SCROLL_CLASSES}>
      {COLUMNS.map((col) => (
        <div key={col.status} className="flex min-w-[300px] flex-1 flex-col">
          <div className="mb-2 flex items-center gap-2 px-1">
            <span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} aria-hidden="true" />
            <div className="h-6 w-24 rounded bg-line" />
          </div>
          <div className={`flex flex-col gap-2 rounded-xl p-2 ${col.tint}`}>
            {[0, 1].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl border border-line bg-surface" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function BoardError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <p className="font-display text-2xl text-ink">Couldn't load your board</p>
      <p className="max-w-sm text-sm text-muted">{message}</p>
      <button
        onClick={onRetry}
        className="rounded-lg bg-todo px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
      >
        Try again
      </button>
    </div>
  )
}

export function Board() {
  const { data: tasks, isLoading, isError, error, refetch } = useTasks()
  const scrollRef = useRef<HTMLDivElement>(null)
  useSuspendSnapDuringDrag(scrollRef)

  if (isLoading) return <BoardSkeleton />
  if (isError) {
    return (
      <BoardError
        message={error instanceof Error ? error.message : 'Something went wrong.'}
        onRetry={() => void refetch()}
      />
    )
  }

  const allTasks = tasks ?? []

  return (
    <div ref={scrollRef} className={SCROLL_CLASSES}>
      {COLUMNS.map((col) => (
        <Column
          key={col.status}
          column={col}
          tasks={allTasks
            .filter((t) => t.status === col.status)
            .sort((a, b) => a.position - b.position)}
        />
      ))}
    </div>
  )
}
