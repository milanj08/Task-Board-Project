// Saturated-pastel palette for member avatars (matches the board theme).
export const AVATAR_COLORS = [
  '#8aa0f2', // periwinkle
  '#f6a96b', // peach
  '#b98bee', // orchid
  '#63cfa0', // mint
  '#f4736e', // coral
  '#f2b34c', // amber
  '#86bee8', // sky
] as const

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
