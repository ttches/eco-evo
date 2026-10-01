/**
 * Whole-second duration as `h:mm:ss`, `m:ss`, or `:ss`, dropping empty leading
 * units: `1:00` and `:59`, never `00:01:00` or `00:00:59`.
 */
export const formatDuration = (seconds: number): string => {
  const total = Math.max(0, Math.round(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = String(total % 60).padStart(2, '0')

  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${secs}`
  if (minutes > 0) return `${minutes}:${secs}`
  return `:${secs}`
}
