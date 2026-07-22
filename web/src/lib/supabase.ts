import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Copy web/.env.example to ' +
      'web/.env.local and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
  )
}

// Single shared client for the whole app. Import this instance everywhere;
// never call createClient again (keeps one auth session + connection).
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist the anonymous session so returning guests keep their board.
    persistSession: true,
    autoRefreshToken: true,
    // Anonymous-only: no OAuth redirect to parse out of the URL.
    detectSessionInUrl: false,
  },
})
