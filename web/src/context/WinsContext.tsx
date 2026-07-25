import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'

// Tracks completed-and-cleared tasks for the Done column's empty state. This is
// a running tally, not derived from the tasks table — the whole point is that it
// survives the task itself being deleted. Persisted in localStorage rather than
// Supabase: it's a per-device fun stat, not app data, and this app already scopes
// everything else (the guest session itself) to one browser via localStorage too.
const STORAGE_KEY = 'taskboard-wins'

function readStoredWins(): number {
  if (typeof window === 'undefined') return 0
  const parsed = Number(window.localStorage.getItem(STORAGE_KEY))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

interface WinsValue {
  wins: number
  recordWin: () => void
}

const WinsContext = createContext<WinsValue | undefined>(undefined)

export function WinsProvider({ children }: { children: ReactNode }) {
  const [wins, setWins] = useState(readStoredWins)

  function recordWin() {
    setWins((w) => {
      const next = w + 1
      window.localStorage.setItem(STORAGE_KEY, String(next))
      return next
    })
  }

  return <WinsContext.Provider value={{ wins, recordWin }}>{children}</WinsContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useWins(): WinsValue {
  const ctx = useContext(WinsContext)
  if (!ctx) throw new Error('useWins must be used within a WinsProvider')
  return ctx
}
