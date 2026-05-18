export function parseUtcDateTime(value?: string | null): Date | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null

  let iso = trimmed
  const hasTimezone = /Z$|[+-]\d{2}:\d{2}$/.test(trimmed)
  const hasT = trimmed.includes('T')

  if (!hasTimezone) {
    if (hasT) {
      iso = `${trimmed}Z`
    } else {
      iso = `${trimmed.replace(' ', 'T')}Z`
    }
  }

  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatLocalDateTime(value?: string | null, options?: {
  locale?: string
  dateOnly?: boolean
  timeOnly?: boolean
  includeSeconds?: boolean
}): string {
  const date = parseUtcDateTime(value)
  if (!date) return ''

  const locale = options?.locale || 'en-LK'
  const includeSeconds = options?.includeSeconds ?? false

  if (options?.dateOnly) {
    return date.toLocaleDateString(locale, { year: 'numeric', month: '2-digit', day: '2-digit' })
  }

  if (options?.timeOnly) {
    return date.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
      second: includeSeconds ? '2-digit' : undefined,
      hour12: true,
    })
  }

  return date.toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    hour12: true,
  })
}
