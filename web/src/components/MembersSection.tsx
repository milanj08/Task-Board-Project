import { useState } from 'react'
import type { FormEvent } from 'react'
import { Minus, Plus } from 'lucide-react'
import { useMembers, useCreateMember, useDeleteMember } from '../hooks/useMembers'
import { AVATAR_COLORS } from '../lib/avatarColors'
import { isUniqueViolation } from '../lib/supabaseErrors'
import { DraggableMember } from './DraggableMember'

export function MembersSection() {
  const { data: members, isLoading, isError } = useMembers()
  const createMember = useCreateMember()
  const deleteMember = useDeleteMember()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(AVATAR_COLORS[0])

  function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    createMember.mutate(
      { name: trimmed, color },
      {
        onSuccess: () => {
          setName('')
          setCreating(false)
        },
      },
    )
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-2xl uppercase tracking-wide text-ink">Members</h2>
        <button
          onClick={() => setCreating((c) => !c)}
          aria-label={creating ? 'Close' : 'New member'}
          className="rounded-lg border border-line p-1.5 text-muted transition hover:text-ink"
        >
          {creating ? (
            <Minus className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Plus className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {creating && (
        <form onSubmit={submit} className="mb-3 flex flex-col gap-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Member name"
            className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink placeholder:text-muted focus:border-todo focus:outline-none"
          />
          <div className="flex items-center gap-1.5">
            {AVATAR_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setColor(c)}
                style={{ background: c }}
                aria-label={`Pick color ${c}`}
                className={`h-5 w-5 rounded-full transition ${
                  color === c ? 'ring-2 ring-ink/40 ring-offset-1' : ''
                }`}
              />
            ))}
          </div>
          <button
            type="submit"
            disabled={createMember.isPending}
            className="rounded-lg bg-todo px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            Add member
          </button>
          {createMember.isError && (
            <p className="text-xs text-high-ink">
              {isUniqueViolation(createMember.error)
                ? 'That name is already taken.'
                : 'Could not add that member. Try again.'}
            </p>
          )}
        </form>
      )}

      {isLoading && <p className="text-sm text-muted">Loading members…</p>}
      {isError && <p className="text-sm text-high-ink">Couldn't load members.</p>}
      {members && members.length === 0 && !creating && (
        <p className="text-sm text-muted">No people yet. Add someone, then drag them into a team.</p>
      )}

      <div className="flex flex-col gap-0.5">
        {members?.map((m) => (
          <DraggableMember
            key={m.id}
            member={m}
            source="roster"
            onRemove={() => deleteMember.mutate(m.id)}
          />
        ))}
      </div>
    </div>
  )
}
