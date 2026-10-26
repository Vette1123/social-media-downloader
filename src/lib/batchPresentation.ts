/**
 * Pure presentation logic for the Pro batch panel — kept out of
 * `BatchPanel.tsx` so this decision-critical routing (which delivery path a
 * finished item takes, how cancellation reads to the user) is unit-testable.
 * See `batchPresentation.test.ts`.
 *
 * Relative imports (not `@/lib/...`) so this loads in the Vitest node
 * environment, which has no path-alias plugin — same convention as
 * `resolve.ts` and `batchQueue.ts`.
 */

import { CANCELLED_ERROR, type BatchItem } from './batchQueue'
import type { ResolveResult } from './resolve'

/** What a finished item's result is made of, for the purposes of delivery. */
export type ResultKind = 'image' | 'audio' | 'video' | 'none'

/**
 * `'none'` covers an embed-only fallback (e.g. YouTube's playable-but-not-
 * downloadable result): the resolve succeeded but there is nothing to save.
 */
export function categorizeResult(result: ResolveResult | undefined): ResultKind {
  if (!result) return 'none'
  if ((result.metadata?.images?.length ?? 0) > 0) return 'image'
  if (result.downloadUrl) return 'video'
  if (result.audioUrl) return 'audio'
  return 'none'
}

/** Whether a finished item's kind belongs in the ZIP path (not video, not none). */
export function isZippable(kind: ResultKind): boolean {
  return kind === 'image' || kind === 'audio'
}

export function isCancelled(item: BatchItem): boolean {
  return item.status === 'failed' && item.error === CANCELLED_ERROR
}

export function rowStatusText(item: BatchItem): string {
  if (isCancelled(item)) return 'Cancelled'
  if (item.status === 'failed') return item.error || 'Failed to resolve'
  if (item.status === 'done') {
    return categorizeResult(item.result) === 'none' ? 'No downloadable media' : 'Done'
  }
  if (item.status === 'resolving') return 'Resolving…'
  return 'Queued'
}

// Cancellation is a user action, not a failure — it gets the same neutral
// tone as "queued", never the red used for a real resolve error. A 'done'
// item with nothing downloadable ('none') gets that same neutral tone rather
// than the green used for an item that actually produced a file.
export function rowStatusColorClass(item: BatchItem): string {
  if (item.status === 'done') {
    return categorizeResult(item.result) === 'none' ? 'text-white/50' : 'text-emerald-300'
  }
  if (item.status === 'failed') return isCancelled(item) ? 'text-white/50' : 'text-red-300'
  if (item.status === 'resolving') return 'text-cyan-300'
  return 'text-white/50'
}

/**
 * Row order for the queue: rows still waiting or resolving stay on top in
 * paste order, and every finished row (done, failed, cancelled) sinks to the
 * bottom in the order it finished. Lanes finish out of order, so paste order
 * alone scatters finished rows through the list.
 *
 * `settled` is the caller's url → finish-sequence ledger, updated here: a row
 * entering a finished state gets the next number, a row leaving one (a retry)
 * loses it and rejoins the pending group.
 */
export function displayOrder(items: BatchItem[], settled: Map<string, number>): BatchItem[] {
  let seq = Math.max(0, ...settled.values())
  for (const item of items) {
    const finished = item.status === 'done' || item.status === 'failed'
    if (!finished) settled.delete(item.url)
    else if (!settled.has(item.url)) settled.set(item.url, ++seq)
  }
  const pending = items.filter((it) => !settled.has(it.url))
  const finished = items
    .filter((it) => settled.has(it.url))
    .sort((a, b) => settled.get(a.url)! - settled.get(b.url)!)
  return [...pending, ...finished]
}
