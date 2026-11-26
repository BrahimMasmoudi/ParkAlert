import type { Car } from '~/stores/cars'

export type CarQueueType = 'activation' | 'deletion' | 'transfer'

export interface WaitDuration {
  bucket: 'just_now' | 'minutes' | 'hours' | 'days'
  count: number
  isStale: boolean
}

const MINUTE_MS = 60_000
const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

/** Parses Firestore Timestamp objects, ISO strings, numbers, or Dates into epoch ms, or null if invalid/absent. */
export function parseTimestampMillis(ts: any): number | null {
  if (ts === null || ts === undefined || ts === '') return null
  if (typeof ts === 'number') return Number.isFinite(ts) ? ts : null
  if (typeof ts.toMillis === 'function') {
    const ms = ts.toMillis()
    return Number.isFinite(ms) ? ms : null
  }
  if (typeof ts.seconds === 'number') {
    return Number.isFinite(ts.seconds) ? ts.seconds * 1000 : null
  }
  if (typeof ts._seconds === 'number') {
    return Number.isFinite(ts._seconds) ? ts._seconds * 1000 : null
  }
  if (typeof ts === 'string' || ts instanceof Date) {
    const ms = new Date(ts).getTime()
    return Number.isFinite(ms) ? ms : null
  }
  return null
}

/** Returns epoch ms for a required timestamp field, defaulting to current time if absent or unparseable. */
export function getTimestampMillis(ts: any): number {
  return parseTimestampMillis(ts) ?? Date.now()
}

/** Returns epoch ms for an optional timestamp field, or undefined when absent or unparseable. */
export function getOptionalTimestampMillis(ts: any): number | undefined {
  return parseTimestampMillis(ts) ?? undefined
}

/** Formats elapsed queue wait duration relative to nowMs, flagging waits of 24+ hours as stale. */
export function formatWaitDuration(timestampMs: number, nowMs: number = Date.now()): WaitDuration {
  const safeNow = Number.isFinite(nowMs) ? nowMs : Date.now()
  const safeTs = Number.isFinite(timestampMs) ? timestampMs : safeNow
  const elapsedMs = Math.max(0, safeNow - safeTs)
  const isStale = elapsedMs >= DAY_MS

  if (elapsedMs < MINUTE_MS) {
    return { bucket: 'just_now', count: 0, isStale }
  }
  if (elapsedMs < HOUR_MS) {
    return { bucket: 'minutes', count: Math.floor(elapsedMs / MINUTE_MS), isStale }
  }
  if (elapsedMs < DAY_MS) {
    return { bucket: 'hours', count: Math.floor(elapsedMs / HOUR_MS), isStale }
  }
  return { bucket: 'days', count: Math.floor(elapsedMs / DAY_MS), isStale }
}

/** Resolves the queue-specific entry timestamp for a pending car review queue. */
export function getCarQueueTimestamp(
  car: Pick<Car, 'createdAt' | 'updatedAt' | 'deletionRequestedAt' | 'transferRequestedAt'>,
  queue: CarQueueType,
): number {
  switch (queue) {
    case 'activation':
      return car.updatedAt ?? car.createdAt
    case 'deletion':
      return car.deletionRequestedAt ?? car.updatedAt ?? car.createdAt
    case 'transfer':
      return car.updatedAt ?? car.transferRequestedAt ?? car.createdAt
  }
}
