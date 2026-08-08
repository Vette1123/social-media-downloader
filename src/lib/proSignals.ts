/**
 * How much work this visitor has done by hand today.
 *
 * Pro cannot be sold on reach — it never unlocks anything a free visitor cannot
 * already download — so the only honest pitch is the one made to somebody who
 * is visibly doing Pro's job manually. That means the pitch has to know when
 * that is happening, which is what this counts.
 *
 * Entirely local. The count lives in localStorage, is keyed by date, and is
 * never sent anywhere: the nudge is a client-side decision about a client-side
 * observation, and shipping "downloads per user per day" to a server to decide
 * where to put a button would be collecting behavioural data to solve a layout
 * problem.
 *
 * Modelled as an external store for the same reason ./prefs is: a nudge that
 * appears one frame after paint reads as a pop-up, and `useSyncExternalStore`
 * gets the stored value on the first client pass with no effect and no
 * hydration mismatch.
 */

import { useSyncExternalStore } from 'react'

const COUNT_KEY = 'smd:resolves'
/** Nudges the visitor has closed. One key, so a new nudge cannot resurrect an old dismissal. */
const DISMISSED_KEY = 'smd:nudged'

/**
 * How many resolves in a day before the header pill is allowed to say more than
 * "Pro".
 *
 * Three is the first count that cannot be a one-off: one is a visit, two is a
 * pair, three is a habit — and a habit is the only thing the queue actually
 * helps with. Set it lower and the pill interrupts people who were never going
 * to want it, which is how persistent chrome earns its blindness.
 */
export const HABIT_THRESHOLD = 3

export interface ProSignals {
  /** Successful resolves today. Resets at local midnight, by date key. */
  today: number
  dismissed: readonly string[]
}

const EMPTY: ProSignals = { today: 0, dismissed: [] }

let cache: ProSignals | null = null
const listeners = new Set<() => void>()

function emit(): void {
  cache = null
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Local date, not UTC — "today" has to mean the visitor's today. */
function dayKey(now: Date): string {
  const month = `${now.getMonth() + 1}`.padStart(2, '0')
  const day = `${now.getDate()}`.padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function readCount(): number {
  try {
    const raw = localStorage.getItem(COUNT_KEY)
    if (!raw) return 0
    const parsed = JSON.parse(raw) as { day?: string; n?: number }
    // A stale day is zero rather than an error: yesterday's habit is not today's.
    if (parsed.day !== dayKey(new Date())) return 0
    return typeof parsed.n === 'number' && parsed.n > 0 ? parsed.n : 0
  } catch {
    return 0
  }
}

function readDismissed(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
  } catch {
    return []
  }
}

function getSnapshot(): ProSignals {
  if (cache) return cache
  if (typeof localStorage === 'undefined') return EMPTY
  cache = { today: readCount(), dismissed: readDismissed() }
  return cache
}

/** Prerender and hydration both see "no signals", which is the quiet state. */
function getServerSnapshot(): ProSignals {
  return EMPTY
}

/**
 * One more link resolved. Called from the single place a successful resolve
 * lands, next to the history write.
 */
export function recordResolve(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(COUNT_KEY, JSON.stringify({ day: dayKey(new Date()), n: readCount() + 1 }))
  } catch {
    // Private mode, or a full quota. A nudge is not worth an exception.
    return
  }
  emit()
}

export function dismissNudge(id: string): void {
  if (typeof localStorage === 'undefined') return
  try {
    const next = [...new Set([...readDismissed(), id])]
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(next))
  } catch {
    return
  }
  emit()
}

export function useProSignals(): ProSignals {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
