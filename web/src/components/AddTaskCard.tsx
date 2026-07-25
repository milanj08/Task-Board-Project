import { useState } from 'react'
import type { FormEvent } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { Plus, X } from 'lucide-react'
import type { TaskPriority } from '../types'
import { useNewTask } from '../context/NewTaskContext'
import { Avatar } from './Avatar'

const PRIORITIES: TaskPriority[] = ['low', 'normal', 'high']

export function AddTaskCard() {
  const { draft, setDraft, removeAssignee, submit, reset, pending, error } = useNewTask()
  const { setNodeRef, isOver } = useDroppable({ id: 'new-task-draft' })
  const [manualOpen, setManualOpen] = useState(false)

  // Open when the user clicks add, or when a member/team has been dropped on it.
  const open = manualOpen || draft.assignees.length > 0

  function cancel() {
    reset()
    setManualOpen(false)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    submit()
  }

  return (
    <div
      ref={setNodeRef}
      className={`rounded-xl border bg-surface transition-colors ${
        isOver ? 'border-todo ring-2 ring-todo/30' : 'border-line'
      }`}
    >
      {open ? (
        <form onSubmit={onSubmit} className="flex flex-col gap-2 p-2">
          <input
            autoFocus
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="Task title"
            className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink placeholder:text-muted focus:border-todo focus:outline-none"
          />

          <textarea
            value={draft.description}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            placeholder="Description (optional)"
            rows={2}
            className="w-full resize-none rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink placeholder:text-muted focus:border-todo focus:outline-none"
          />

          <div className="flex gap-2">
            <select
              value={draft.priority}
              onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value as TaskPriority }))}
              className="flex-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink focus:border-todo focus:outline-none"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p[0].toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={draft.due_date}
              onChange={(e) => setDraft((d) => ({ ...d, due_date: e.target.value }))}
              className="flex-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink focus:border-todo focus:outline-none"
            />
          </div>

          <div className="rounded-lg border border-dashed border-line p-1.5">
            {draft.assignees.length === 0 ? (
              <p className="px-1 py-0.5 text-xs text-muted">Drag members here to assign</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {draft.assignees.map((a) => (
                  <span
                    key={a.id}
                    className="flex items-center gap-1 rounded-full bg-canvas py-0.5 pl-0.5 pr-1.5"
                  >
                    <Avatar name={a.name} color={a.color} size={20} />
                    <span className="text-xs text-ink">{a.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAssignee(a.id)}
                      aria-label={`Remove ${a.name}`}
                      className="text-muted transition-colors hover:text-ink"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!draft.title.trim() || pending}
              className="rounded-lg bg-todo px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              Add task
            </button>
            <button
              type="button"
              onClick={cancel}
              className="rounded-lg px-3 py-1.5 text-xs text-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setManualOpen(true)}
          className="flex w-full items-center gap-1.5 p-3 text-left text-sm text-muted transition hover:text-ink"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add task
        </button>
      )}

      {error && (
        <p className="px-3 pb-2 text-xs text-high-ink">{error.message}</p>
      )}
    </div>
  )
}
