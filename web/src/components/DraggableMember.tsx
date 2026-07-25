import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { X } from 'lucide-react'
import type { Member } from '../types'
import { Avatar } from './Avatar'

export function DraggableMember({
  member,
  source,
  onRemove,
}: {
  member: Member
  source: string
  onRemove?: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${source}-member-${member.id}`,
    data: { type: 'member', member },
  })
  const [confirmRemove, setConfirmRemove] = useState(false)

  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      {...listeners}
      {...attributes}
      className="group flex touch-none cursor-grab items-center gap-2 rounded-md px-1 py-0.5 transition-colors hover:bg-canvas active:cursor-grabbing"
    >
      <Avatar name={member.name} color={member.color} />
      <span className="flex-1 truncate text-sm text-ink">{member.name}</span>
      {onRemove &&
        (confirmRemove ? (
          <span className="flex shrink-0 items-center gap-1 text-xs font-medium">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                onRemove()
              }}
              className="rounded px-1.5 py-0.5 text-high-ink transition-colors hover:bg-high hover:text-white"
            >
              Remove
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                setConfirmRemove(false)
              }}
              className="rounded px-1.5 py-0.5 text-muted transition-colors hover:text-ink"
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              setConfirmRemove(true)
            }}
            aria-label={`Remove ${member.name}`}
            // Always visible on mobile (no hover state to reveal it there);
            // fades in on hover for desktop, same as before.
            className="shrink-0 text-muted opacity-100 transition hover:text-high-ink md:opacity-0 md:group-hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ))}
    </div>
  )
}
