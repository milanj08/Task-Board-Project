import { useState } from 'react'
import type { ReactNode } from 'react'
import { format, parseISO } from 'date-fns'
import { Trash2, X } from 'lucide-react'
import type { TaskWithAssignees } from '../types'
import { getDueStatus } from '../lib/dueDate'
import { HOVER_TINT } from '../lib/columns'
import { Avatar } from './Avatar'

function Badge({
  className,
  title,
  children,
}: {
  className: string
  title?: string
  children: ReactNode
}) {
  return (
    <span title={title} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${className}`}>
      {children}
    </span>
  )
}

export function TaskCard({
  task,
  controls,
  onClick,
  expanded = false,
  onRemoveAssignee,
  onDelete,
}: {
  task: TaskWithAssignees
  controls?: ReactNode
  onClick?: () => void
  expanded?: boolean
  onRemoveAssignee?: (memberId: string) => void
  onDelete?: () => void
}) {
  const due = getDueStatus(task.due_date)
  const assignees = task.assignees ?? []
  const [confirmDelete, setConfirmDelete] = useState(false)
  const dueLabel = task.due_date ? format(parseISO(task.due_date), 'MMM d, yyyy') : undefined
  const showRow =
    task.priority !== 'normal' || due !== null || (!expanded && assignees.length > 0)
  const showBody = Boolean(task.description) || showRow || expanded

  return (
    <div
      onClick={onClick}
      className={`group overflow-hidden rounded-xl border border-line bg-surface ${onClick ? 'cursor-pointer' : ''}`}
    >
      {/* Top bar tints on hover of the whole card, not just itself, so the
          color cue still reads even though the click target is now the card. */}
      <div
        className={`flex items-start justify-between gap-2 rounded-t-xl px-3 pt-3 pb-2 transition-colors ${
          onClick ? HOVER_TINT[task.status] : ''
        }`}
      >
        <p className="min-w-0 flex-1 font-display text-lg leading-snug text-ink">{task.title}</p>
        {controls && <div className="shrink-0">{controls}</div>}
      </div>

      {showBody && (
        <div className="px-3 pb-3">
          {task.description && (
            <p className={`text-xs text-muted ${expanded ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>
              {task.description}
            </p>
          )}

          {showRow && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {task.priority === 'high' && <Badge className="bg-high-tint text-high-ink">High</Badge>}
              {task.priority === 'low' && <Badge className="bg-low-tint text-low-ink">Low</Badge>}
              {due === 'overdue' && (
                <Badge className="bg-high-tint text-high-ink" title={dueLabel}>Overdue</Badge>
              )}
              {due === 'soon' && (
                <Badge className="bg-due-tint text-due-ink" title={dueLabel}>Due soon</Badge>
              )}
              {due === 'later' && task.due_date && (
                <span className="text-xs text-muted">{format(parseISO(task.due_date), 'MMM d')}</span>
              )}

              {!expanded && assignees.length > 0 && (
                <span className="ml-auto flex -space-x-1.5">
                  {assignees.map((a) => (
                    <Avatar
                      key={a.id}
                      name={a.name}
                      color={a.color}
                      size={22}
                      className="ring-2 ring-surface"
                    />
                  ))}
                </span>
              )}
            </div>
          )}

          {expanded && task.due_date && (due === 'overdue' || due === 'soon') && (
            <p className="mt-3 text-sm text-ink">
              <span className="text-muted">Due </span>
              {format(parseISO(task.due_date), 'EEEE, MMM d, yyyy')}
            </p>
          )}

          {expanded && (
            <div className="mt-3">
              <p className="mb-1.5 text-xs uppercase tracking-wide text-muted">Assignees</p>
              {assignees.length === 0 ? (
                <p className="text-sm text-muted">No one assigned</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {assignees.map((a) => (
                    <div key={a.id} className="flex items-center gap-2">
                      <Avatar name={a.name} color={a.color} />
                      <span className="flex-1 text-sm text-ink">{a.name}</span>
                      {onRemoveAssignee && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onRemoveAssignee(a.id)
                          }}
                          aria-label={`Remove ${a.name}`}
                          className="text-muted transition hover:text-high-ink"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {expanded &&
        onDelete &&
        (confirmDelete ? (
          <div className="flex border-t border-line text-xs font-medium">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              className="flex-1 bg-high-tint py-2.5 text-high-ink transition-colors hover:bg-high hover:text-white"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setConfirmDelete(false)
              }}
              className="flex-1 bg-surface py-2.5 text-muted transition-colors hover:bg-canvas hover:text-ink"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setConfirmDelete(true)
            }}
            className="flex w-full items-center justify-center gap-1.5 border-t border-line bg-surface py-2.5 text-xs font-medium text-high-ink transition-colors hover:bg-high hover:text-white"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Delete task
          </button>
        ))}
    </div>
  )
}
