const LOME_TIMEZONE = 'Africa/Lome'

export function getLomeDateKey(input: Date | string | number = new Date()): string | null {
  const date = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: LOME_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function isTodayInLome(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  const targetKey = getLomeDateKey(dateStr)
  const todayKey = getLomeDateKey(new Date())
  if (!targetKey || !todayKey) return false
  return targetKey === todayKey
}

export function isInPeriodLome(
  dateStr: string | null | undefined,
  period: 'today' | '7d' | '30d'
): boolean {
  if (!dateStr) return false
  const targetKey = getLomeDateKey(dateStr)
  const todayKey = getLomeDateKey(new Date())
  if (!targetKey || !todayKey) return false

  if (period === 'today') {
    return targetKey === todayKey
  }

  const days = period === '7d' ? 6 : 29
  const todayMiddayUtc = new Date(`${todayKey}T12:00:00Z`)
  const startMiddayUtc = new Date(todayMiddayUtc.getTime() - days * 86400000)
  const startKey = startMiddayUtc.toISOString().slice(0, 10)
  return targetKey >= startKey && targetKey <= todayKey
}

export function formatLomeDateFr(input: Date | string = new Date()): string {
  const date = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('fr-FR', {
    timeZone: LOME_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function getLomeDayStartIso(input: Date = new Date()): string {
  const todayKey = getLomeDateKey(input) ?? new Date().toISOString().slice(0, 10)
  // Africa/Lome est en UTC+0 toute l'année (GMT)
  return `${todayKey}T00:00:00.000Z`
}
