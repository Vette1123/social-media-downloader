import type { ResolveResult } from './resolve'

export const MAX_BATCH_URLS = 20

/**
 * Two at a time. The extractors are third-party and several of them rate-limit
 * by IP; a batch that hammers them just converts into a batch of failures.
 */
export const BATCH_CONCURRENCY = 2

export type BatchItemStatus = 'queued' | 'resolving' | 'done' | 'failed'

export interface BatchItem {
  url: string
  status: BatchItemStatus
  result?: ResolveResult
  error?: string
}

/**
 * Accepts however the user pasted them: one per line, comma-separated, or space
 * separated. Duplicates are dropped because resolving the same link twice is
 * always a mistake, and the list is capped so a paste of a thousand links
 * cannot be turned into a thousand extractor calls.
 */
export function parseBatchInput(raw: string): string[] {
  const parts = raw
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter(Boolean)
  return [...new Set(parts)].slice(0, MAX_BATCH_URLS)
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Failed to resolve'
}

/**
 * A bounded-concurrency queue. Workers pull from a shared cursor rather than
 * the list being chunked, so one slow link does not idle the other lane: as
 * soon as either lane finishes an item it grabs the next unclaimed index, so
 * a batch of [slow, fast, fast, fast] keeps both lanes busy instead of one
 * lane sitting idle behind the slow item.
 *
 * Cancellation note: there is no `signal` parameter here on purpose. The
 * underlying `resolve()` (src/lib/resolve.ts) calls `resolveTikTokInBrowser`
 * first for TikTok links, which runs its own internal 6-second
 * AbortController and takes no external signal (src/lib/tikwmClient.ts:29).
 * That means even a future "cancel this item" feature cannot interrupt the
 * TikTok phase early — the caller would still wait out up to 6 seconds of
 * uncancellable work per in-flight TikTok item. This queue does not pretend
 * otherwise: it has no cancellation API at all rather than one that lies
 * about being immediate.
 *
 * Per-item failure handling: `resolve()` can both reject (network failure,
 * or a non-JSON/error response body since it has no `response.ok` check) and
 * resolve with `{ success: false, error }`. Both are caught here and folded
 * into the same 'failed' status with a human-readable `error` string, so one
 * bad link never throws out of `runBatch` or stops the other lanes.
 */
export async function runBatch(
  urls: string[],
  resolveFn: (url: string) => Promise<ResolveResult>,
  onUpdate: (items: BatchItem[]) => void,
): Promise<BatchItem[]> {
  const items: BatchItem[] = urls.map((url) => ({ url, status: 'queued' }))
  let cursor = 0

  const publish = () => onUpdate(items.map((item) => ({ ...item })))

  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++
      const item = items[index]
      item.status = 'resolving'
      publish()

      try {
        const result = await resolveFn(item.url)
        if (result?.success) {
          item.status = 'done'
          item.result = result
        } else {
          item.status = 'failed'
          item.error = result?.error || 'Failed to resolve'
        }
      } catch (error) {
        item.status = 'failed'
        item.error = messageOf(error)
      }
      publish()
    }
  }

  const lanes = Math.min(BATCH_CONCURRENCY, items.length)
  await Promise.all(Array.from({ length: lanes }, () => worker()))
  return items
}
