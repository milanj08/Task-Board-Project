import { initialsOf } from '../lib/avatarColors'

export function Avatar({
  name,
  color,
  size = 24,
  className = '',
}: {
  name: string
  color: string | null
  size?: number
  className?: string
}) {
  return (
    <span
      title={name}
      style={{ width: size, height: size, background: color ?? '#8aa0f2' }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full text-[11px] font-medium text-white ${className}`}
    >
      {initialsOf(name)}
    </span>
  )
}
