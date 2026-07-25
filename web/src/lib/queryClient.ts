import { QueryClient } from '@tanstack/react-query'

// Single shared query client for the app.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30s: avoid needless refetches during a session
      refetchOnWindowFocus: false, // don't flicker the board when tabbing back
      retry: 1,
    },
  },
})
