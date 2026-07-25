import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { ColumnDef } from '../lib/columns'
import type { TaskWithAssignees } from '../types'
import { DraggableTaskCard } from './DraggableTaskCard'
import { AddTaskCard } from './AddTaskCard'

export function Column({ column, tasks }: { column: ColumnDef; tasks: TaskWithAssignees[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.status, data: { type: 'column' } })
  const isTodo = column.status === 'todo'
  const isDone = column.status === 'done'
  const [showDone, setShowDone] = useState(false)

  // Done starts collapsed once it has cards; the user can reveal them.
  const collapsedDone = isDone && !showDone && tasks.length > 0

  return (
    <div className="flex max-h-full min-w-[300px] flex-1 snap-center snap-always flex-col">
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className={`h-2.5 w-2.5 rounded-full ${column.dot}`} aria-hidden="true" />
        <h2 className="font-display text-2xl uppercase tracking-wide leading-none text-ink">
          {column.label}
        </h2>
      </div>

      <div
        ref={setNodeRef}
        className={`flex min-h-0 flex-col gap-2 overflow-y-auto rounded-xl p-2 ring-2 transition-colors ${column.tint} ${
          isOver ? 'ring-ink/15' : 'ring-transparent'
        }`}
      >
        {isTodo && <AddTaskCard />}

        {collapsedDone ? (
          <button
            type="button"
            onClick={() => setShowDone(true)}
            className="rounded-xl border border-dashed border-line px-3 py-3 text-center text-xs text-muted transition hover:border-ink/20 hover:text-ink"
          >
            Show {tasks.length} completed
          </button>
        ) : (
          <>
            {isDone && showDone && tasks.length > 0 && (
              <button
                type="button"
                onClick={() => setShowDone(false)}
                className="self-start px-1 text-xs text-muted transition hover:text-ink"
              >
                Hide completed
              </button>
            )}

            {tasks.length === 0 && !isTodo && column.empty && (
              <p className="px-3 py-8 text-center text-sm text-muted">{column.empty}</p>
            )}

            <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
              {tasks.map((t) => (
                <DraggableTaskCard key={t.id} task={t} />
              ))}
            </SortableContext>
          </>
        )}
      </div>
    </div>
  )
}
