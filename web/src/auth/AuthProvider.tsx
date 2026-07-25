import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'

type AuthStatus = 'loading' | 'ready' | 'error'

interface AuthValue {
  status: AuthStatus
  error: string | null
}

const AuthContext = createContext<AuthValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function init() {
      try {
        // Returning guest: reuse the persisted session (keeps their board).
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (session) {
          if (active) setStatus('ready')
          return
        }

        // New guest: create an anonymous session.
        const { error: signInError } = await supabase.auth.signInAnonymously()
        if (signInError) throw signInError

        if (active) setStatus('ready')
      } catch (e) {
        if (active) {
          setError(e instanceof Error ? e.message : 'Could not start your session.')
          setStatus('error')
        }
      }
    }

    void init()

    return () => {
      active = false
    }
  }, [])

  return (
    <AuthContext.Provider value={{ status, error }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
