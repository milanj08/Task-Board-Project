import { useState } from 'react'
import { Sparkles, Trash2 } from 'lucide-react'
import { useTasks } from '../hooks/useTasks'
import { useTeams } from '../hooks/useTeams'
import { useMembers } from '../hooks/useMembers'
import { useLoadSampleBoard, useClearBoard } from '../hooks/useSampleBoard'
import { useWins } from '../context/WinsContext'

// One slot at the bottom of the sidebar that does whichever thing makes sense:
// fill an empty board so a first visit shows something, or empty a full one.
// Clearing is behind a two-step confirm, the same as removing a person.
//
// `mt-auto` keeps it pinned to the bottom while the sidebar has room to spare,
// and lets it fall in below the last team once the list is long enough to
// scroll — so it never sits on top of a team the way a fixed button would.
export function SampleBoardButton() {
  const { data: tasks } = useTasks()
  const { data: teams } = useTeams()
  const { data: members } = useMembers()
  const loadSample = useLoadSampleBoard()
  const clearBoard = useClearBoard()
  const { resetWins } = useWins()
  const [confirmClear, setConfirmClear] = useState(false)

  // Wait for all three before deciding which button to show, so a returning
  // guest never sees "Load sample board" flash over their own work.
  if (!tasks || !teams || !members) return null

  const isEmpty = tasks.length === 0 && teams.length === 0 && members.length === 0
  const busy = loadSample.isPending || clearBoard.isPending

  return (
    <div className="mt-auto flex justify-center pt-6">
      {isEmpty ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => loadSample.mutate()}
          className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink shadow-sm transition-colors hover:bg-canvas disabled:opacity-60"
        >
          <Sparkles className="h-4 w-4 text-muted" aria-hidden="true" />
          {loadSample.isPending ? 'Loading sample…' : 'Load sample board'}
        </button>
      ) : confirmClear ? (
        <span className="flex items-center gap-1 rounded-lg border border-line bg-surface p-1 text-sm shadow-sm">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              clearBoard.mutate(undefined, {
                onSuccess: () => {
                  resetWins()
                  setConfirmClear(false)
                },
              })
            }}
            className="rounded px-2 py-1 font-medium text-high-ink transition-colors hover:bg-high hover:text-white disabled:opacity-60"
          >
            {clearBoard.isPending ? 'Clearing…' : 'Clear everything'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmClear(false)}
            className="rounded px-2 py-1 text-muted transition-colors hover:text-ink"
          >
            Cancel
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmClear(true)}
          className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-muted shadow-sm transition-colors hover:text-ink"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Clear board
        </button>
      )}
    </div>
  )
}
