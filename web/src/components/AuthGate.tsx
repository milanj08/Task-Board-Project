import type { ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'

function CenteredState({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
      {children}
    </div>
  )
}

export function AuthGate({ children }: { children: ReactNode }) {
  const { status, error } = useAuth()

  if (status === 'loading') {
    return (
      <CenteredState>
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-todo"
          aria-hidden="true"
        />
        <p className="font-display text-2xl text-ink">Setting up your board…</p>
      </CenteredState>
    )
  }

  if (status === 'error') {
    return (
      <CenteredState>
        <p className="font-display text-2xl text-ink">Couldn't start your session</p>
        <p className="max-w-sm text-sm text-muted">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-todo px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
        >
          Try again
        </button>
      </CenteredState>
    )
  }

  return <>{children}</>
}
