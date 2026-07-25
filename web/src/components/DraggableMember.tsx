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
      {onRemove && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onRemove}
          aria-label={`Remove ${member.name}`}
          className="text-muted opacity-0 transition hover:text-high-ink group-hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
