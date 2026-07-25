import { useState } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { ChevronRight, GripVertical, Trash2 } from 'lucide-react'
import type { TeamWithMembers } from '../types'
import { useDeleteTeam, useRemoveMemberFromTeam } from '../hooks/useTeams'
import { DraggableMember } from './DraggableMember'

export function TeamSection({ team }: { team: TeamWithMembers }) {
  const [open, setOpen] = useState(true)
  const deleteTeam = useDeleteTeam()
  const removeFromTeam = useRemoveMemberFromTeam()

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `team-${team.id}`,
    data: { type: 'team', team },
  })
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `team-drop-${team.id}`,
    data: { type: 'team-drop', teamId: team.id },
  })
  const setRefs = (node: HTMLElement | null) => {
    setDragRef(node)
    setDropRef(node)
  }

  return (
    <div
      ref={setRefs}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      className={`rounded-xl border bg-surface transition-colors ${
        isOver ? 'border-todo ring-2 ring-todo/40' : 'border-line'
      }`}
    >
      <div className="flex items-center gap-0.5 px-2 py-2">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex flex-1 items-center gap-1.5 text-left"
        >
          <ChevronRight
            className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? 'rotate-90' : ''}`}
            aria-hidden="true"
          />
          <span className="truncate font-display text-lg text-ink">{team.name}</span>
        </button>

        <button
          {...listeners}
          {...attributes}
          aria-label={`Drag ${team.name} to assign everyone`}
          className="cursor-grab touch-none p-1 text-muted transition hover:text-ink active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => deleteTeam.mutate(team.id)}
          aria-label={`Delete ${team.name}`}
          className="p-1 text-muted transition hover:text-high-ink"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {open && (
        <div className="px-3 pb-3">
          {team.members.length === 0 ? (
            <p className="text-xs text-muted">Drag people here from Members.</p>
          ) : (
            <div className="flex flex-col gap-0.5">
              {team.members.map((m) => (
                <DraggableMember
                  key={m.id}
                  member={m}
                  source={`team-${team.id}`}
                  onRemove={() => removeFromTeam.mutate({ teamId: team.id, memberId: m.id })}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
