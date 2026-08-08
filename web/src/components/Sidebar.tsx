import { useState } from 'react'
import type { FormEvent } from 'react'
import { Minus, Plus, X } from 'lucide-react'
import { useTeams, useCreateTeam } from '../hooks/useTeams'
import { TeamSection } from './TeamSection'
import { MembersSection } from './MembersSection'
import { SampleBoardButton } from './SampleBoardButton'

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data: teams, isLoading, isError } = useTeams()
  const createTeam = useCreateTeam()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  function submitTeam(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    createTeam.mutate({ name: trimmed })
    setName('')
    setCreating(false)
  }

  return (
    <>
      {/* Backdrop: mobile only, dismisses the drawer */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-ink/30 transition-opacity md:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-72 shrink-0 flex-col overflow-y-auto border-r border-line bg-surface p-4 shadow-xl transition-transform duration-200 ease-out md:static md:z-auto md:translate-x-0 md:bg-surface/40 md:shadow-none ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-3xl text-ink">Task Board</h1>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-lg border border-line p-1.5 text-muted transition hover:text-ink md:hidden"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <MembersSection />

        <div className="mb-3 mt-6 flex items-center justify-between">
          <h2 className="font-display text-2xl uppercase tracking-wide text-ink">Teams</h2>
          <button
            onClick={() => setCreating((c) => !c)}
            aria-label={creating ? 'Close' : 'New team'}
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
          <form onSubmit={submitTeam} className="mb-3">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Team name"
              className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink placeholder:text-muted focus:border-todo focus:outline-none"
            />
          </form>
        )}

        {isLoading && <p className="text-sm text-muted">Loading teams…</p>}
        {isError && <p className="text-sm text-high-ink">Couldn't load teams.</p>}
        {teams && teams.length === 0 && !creating && (
          <p className="text-sm text-muted">No teams yet. Add one, then drag people in.</p>
        )}

        <div className="flex flex-col gap-2">
          {teams?.map((team) => (
            <TeamSection key={team.id} team={team} />
          ))}
        </div>

        <SampleBoardButton />
      </aside>
    </>
  )
}
