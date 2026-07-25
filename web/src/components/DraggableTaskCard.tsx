import { useEffect, useRef, useState } from 'react'
import { useDndContext, useDroppable } from '@dnd-kit/core'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check, ChevronRight, GripVertical } from 'lucide-react'
import type { TaskWithAssignees } from '../types'
import { NEXT_MOVE } from '../lib/columns'
import { computeEnd } from '../lib/position'
import { useTasks, useMoveTask, useRemoveAssignee, useDeleteTask } from '../hooks/useTasks'
import { useWins } from '../context/WinsContext'
import { TaskCard } from './TaskCard'

const DISSOLVE_MS = 4000
const HOVER_EXPAND_MS = 550

export function DraggableTaskCard({ task }: { task: TaskWithAssignees }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', task },
  })
  const { data: tasks } = useTasks()
  const moveTask = useMoveTask()
  const removeAssignee = useRemoveAssignee()
  const deleteTask = useDeleteTask()
  const { recordWin } = useWins()
  const [expanded, setExpanded] = useState(false)
  const [dissolving, setDissolving] = useState(false)
  const timerRef = useRef<number | null>(null)

  // Always droppable — even collapsed, a card can be dropped on directly. Hovering
  // (without dropping) for HOVER_EXPAND_MS also auto-expands a collapsed card, so a
  // deliberate pause reveals the full assignee list instead of just adding blind.
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `assign-${task.id}`,
    data: { type: 'assign', taskId: task.id },
  })

  const next = NEXT_MOVE[task.status]
  const isDone = task.status === 'done'
  const { measureDroppableContainers } = useDndContext()

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!isOver || expanded) return
    const id = window.setTimeout(() => setExpanded(true), HOVER_EXPAND_MS)
    return () => window.clearTimeout(id)
  }, [isOver, expanded])

  // Expanding reveals the Assignees section, growing the card — but the drop
  // zone's hit area was measured before that happened, so the newly-revealed
  // bottom (e.g. the "No one assigned" row) wouldn't register a drop without an
  // explicit re-measure right after the resize.
  useEffect(() => {
    measureDroppableContainers([`assign-${task.id}`])
  }, [expanded, measureDroppableContainers, task.id])

  function startDissolve() {
    setDissolving(true)
    timerRef.current = window.setTimeout(() => {
      deleteTask.mutate(task.id)
      recordWin()
    }, DISSOLVE_MS)
  }

  function cancelDissolve() {
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = null
    setDissolving(false)
  }

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const controls = (
    <div className="flex items-center gap-1">
      <button
        {...listeners}
        {...attributes}
        onClick={(e) => e.stopPropagation()}
        aria-label="Drag task"
        className="cursor-grab touch-none text-muted transition hover:text-ink active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" aria-hidden="true" />
      </button>

      {isDone ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            startDissolve()
          }}
          aria-label="Complete and clear"
          className="rounded-md border border-line px-0.5 py-1.5 text-muted transition-colors hover:border-done hover:bg-done hover:text-white"
        >
          <Check className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : (
        next && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              moveTask.mutate({
                id: task.id,
                status: next.status,
                position: computeEnd(tasks ?? [], next.status, task.id),
              })
            }}
            aria-label={`Move to ${next.label}`}
            className={`rounded-md border border-line px-0.5 py-1.5 text-muted transition-colors ${next.hover}`}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        )
      )}
    </div>
  )

  return (
    <div ref={setNodeRef} style={style} className="animate-pop-in">
      <div
        ref={setDropRef}
        className={`rounded-xl transition ${isOver ? 'animate-glow-pulse ring-2 ring-todo' : ''}`}
      >
        {dissolving ? (
          <div className="animate-dissolve flex items-center justify-between gap-2 rounded-xl border border-done-ink/30 bg-done p-3">
            <p className="min-w-0 flex-1 truncate font-display text-lg leading-snug text-white">
              {task.title}
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                cancelDissolve()
              }}
              className="shrink-0 rounded-md border border-done-ink bg-done px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
            >
              Undo
            </button>
          </div>
        ) : (
          <TaskCard
            task={task}
            controls={controls}
            onClick={() => setExpanded((x) => !x)}
            expanded={expanded}
            onRemoveAssignee={(memberId) => removeAssignee.mutate({ taskId: task.id, memberId })}
            onDelete={() => deleteTask.mutate(task.id)}
          />
        )}
      </div>
    </div>
  )
}
