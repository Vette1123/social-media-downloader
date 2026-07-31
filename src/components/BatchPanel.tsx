'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import {
  CANCELLED_ERROR,
  MAX_BATCH_URLS,
  parseBatchInput,
  runBatch,
  type BatchItem,
  type BatchItemStatus,
} from '@/lib/batchQueue'
import { buildDownloadFilename } from '@/lib/filename'
import { resolve, type ResolveResult } from '@/lib/resolve'
import { useProToken, useTier } from '@/lib/entitlements'
import { CheckIcon, SpinnerIcon } from '@/components/icons'

/**
 * Pro's headline feature: paste up to MAX_BATCH_URLS links and resolve them as
 * a queue (see `src/lib/batchQueue.ts` for the driver). Delivery is
 * deliberately not "always ZIP" — a client-side archive of twenty videos would
 * exhaust memory on the phones this audience uses:
 *  - Video results save individually, one per finished item, reusing the same
 *    direct-tunnel-first / proxy-fallback path the single-link flow uses so
 *    Cobalt tunnel bytes keep bypassing the Worker.
 *  - Image and audio results collect into a single ZIP, built with the same
 *    lazily-imported JSZip the single-link image gallery already uses.
 */

/** What a finished item's result is made of, for the purposes of delivery. */
type ResultKind = 'image' | 'audio' | 'video' | 'none'

function categorizeResult(result: ResolveResult | undefined): ResultKind {
  if (!result) return 'none'
  if ((result.metadata?.images?.length ?? 0) > 0) return 'image'
  if (result.downloadUrl) return 'video'
  if (result.audioUrl) return 'audio'
  return 'none'
}

function isCancelled(item: BatchItem): boolean {
  return item.status === 'failed' && item.error === CANCELLED_ERROR
}

function rowStatusText(item: BatchItem): string {
  if (isCancelled(item)) return 'Cancelled'
  if (item.status === 'failed') return item.error || 'Failed to resolve'
  if (item.status === 'done') return 'Done'
  if (item.status === 'resolving') return 'Resolving…'
  return 'Queued'
}

// Cancellation is a user action, not a failure — it gets the same neutral
// tone as "queued", never the red used for a real resolve error.
function rowStatusColorClass(item: BatchItem): string {
  if (item.status === 'done') return 'text-emerald-300'
  if (item.status === 'failed') return isCancelled(item) ? 'text-white/40' : 'text-red-300'
  if (item.status === 'resolving') return 'text-cyan-300'
  return 'text-white/40'
}

// Save one already-fetched body under our own filename — same technique the
// single-link flow uses, duplicated locally rather than imported since the
// original isn't exported (DownloaderApp.tsx is off-limits for this task).
function saveBlobLocally(blob: Blob, filename: string) {
  const blobUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(blobUrl)
}

// Hand a Cobalt tunnel URL straight to the browser's download manager via a
// throwaway iframe — same technique `triggerDirectDownload` uses in
// DownloaderApp.tsx, kept local for the same reason as saveBlobLocally above.
function triggerTunnelDownload(url: string) {
  const iframe = document.createElement('iframe')
  iframe.style.display = 'none'
  iframe.src = url
  document.body.appendChild(iframe)
  window.setTimeout(() => iframe.remove(), 120000)
}

/**
 * Save a finished video item the moment it resolves. Prefers the direct
 * Cobalt tunnel URL (bytes flow browser→instance, never through our Worker);
 * falls back to fetching the proxied URL when no tunnel was issued. Best
 * effort — a save failure here doesn't change the item's resolved status, it
 * just means that one video needs a manual re-download.
 */
async function saveVideoResult(result: ResolveResult): Promise<void> {
  const meta = result.metadata
  const filename = buildDownloadFilename({
    platform: meta?.platform,
    author: meta?.author,
    title: meta?.title,
    ext: 'mp4',
  })
  try {
    const direct = meta?.directVideoUrl
    if (direct) {
      triggerTunnelDownload(direct)
      return
    }
    if (!result.downloadUrl) return
    const response = await fetch(result.downloadUrl)
    if (!response.ok) return
    saveBlobLocally(await response.blob(), filename)
  } catch {
    // Network hiccup or an expired proxy URL — silent, matches the best-effort
    // contract described above.
  }
}

/** Fetch every image/audio "done" item and fold it into one ZIP archive. */
async function buildBatchZip(zipCandidates: BatchItem[]): Promise<Blob> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()

  for (const item of zipCandidates) {
    const result = item.result
    if (!result) continue
    const meta = result.metadata
    const kind = categorizeResult(result)

    if (kind === 'image') {
      const images = meta?.images ?? []
      for (let i = 0; i < images.length; i++) {
        const img = images[i]
        try {
          const response = await fetch(img.url)
          if (!response.ok) continue
          zip.file(
            buildDownloadFilename({
              platform: meta?.platform,
              author: meta?.author,
              title: meta?.title,
              ext: 'jpg',
              index: i + 1,
              total: images.length,
            }),
            await response.arrayBuffer(),
          )
        } catch {
          // One bad image shouldn't drop the rest of the archive.
        }
      }
    } else if (kind === 'audio' && result.audioUrl) {
      try {
        const response = await fetch(result.audioUrl)
        if (response.ok) {
          zip.file(
            buildDownloadFilename({
              platform: meta?.platform,
              author: meta?.author,
              title: meta?.title,
              ext: 'mp3',
            }),
            await response.arrayBuffer(),
          )
        }
      } catch {
        // Same best-effort contract as the image branch above.
      }
    }
  }

  // STORE, not DEFLATE: these are already-compressed JPEGs/MP3s, so deflating
  // them buys nothing but a frozen tab on a big batch (mirrors the single-link
  // image ZIP in DownloaderApp.tsx).
  return zip.generateAsync({ type: 'blob', compression: 'STORE' })
}

function StatusIcon({ item }: { item: BatchItem }) {
  if (item.status === 'done') {
    return <CheckIcon className='h-3.5 w-3.5 shrink-0 text-emerald-300' />
  }
  if (item.status === 'resolving') {
    return <SpinnerIcon className='h-3.5 w-3.5 shrink-0 text-cyan-300' />
  }
  if (item.status === 'failed' && !isCancelled(item)) {
    return (
      <span aria-hidden className='shrink-0 text-red-300'>
        ⚠
      </span>
    )
  }
  return null
}

export function BatchPanel() {
  const tier = useTier()
  const proToken = useProToken()

  const [rawInput, setRawInput] = useState('')
  const [items, setItems] = useState<BatchItem[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [isZipping, setIsZipping] = useState(false)
  const [note, setNote] = useState('')

  // Tracks each url's previous status across successive `onUpdate` broadcasts
  // so a video is auto-saved exactly once, on the transition into 'done' —
  // not on every later broadcast that merely repeats it.
  const prevStatusRef = useRef<Map<string, BatchItemStatus>>(new Map())
  const abortRef = useRef<AbortController | null>(null)

  const parsedUrls = useMemo(() => parseBatchInput(rawInput), [rawInput])

  const zipCandidateCount = useMemo(
    () =>
      items.filter(
        (item) => item.status === 'done' && categorizeResult(item.result) !== 'video',
      ).length,
    [items],
  )

  const handleUpdate = useCallback((nextItems: BatchItem[]) => {
    setItems(nextItems)
    for (const item of nextItems) {
      const prevStatus = prevStatusRef.current.get(item.url)
      prevStatusRef.current.set(item.url, item.status)
      if (prevStatus !== 'done' && item.status === 'done' && item.result) {
        if (categorizeResult(item.result) === 'video') {
          void saveVideoResult(item.result)
        }
      }
    }
  }, [])

  const handleStart = useCallback(async () => {
    if (isRunning || parsedUrls.length === 0) return
    const controller = new AbortController()
    abortRef.current = controller
    prevStatusRef.current = new Map()
    setNote('')
    setIsRunning(true)
    setItems(parsedUrls.map((url) => ({ url, status: 'queued' })))
    try {
      await runBatch(
        parsedUrls,
        (url, signal) => resolve(url, { proToken, signal }),
        handleUpdate,
        controller.signal,
      )
    } finally {
      setIsRunning(false)
      abortRef.current = null
    }
  }, [handleUpdate, isRunning, parsedUrls, proToken])

  const handleCancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const handleSaveAll = useCallback(async () => {
    const zipCandidates = items.filter(
      (item) => item.status === 'done' && categorizeResult(item.result) !== 'video',
    )
    if (zipCandidates.length === 0 || isZipping) return
    setIsZipping(true)
    setNote('')
    try {
      const blob = await buildBatchZip(zipCandidates)
      saveBlobLocally(blob, buildDownloadFilename({ title: 'batch', ext: 'zip' }))
      setNote(`${zipCandidates.length} photo/audio item(s) saved as a ZIP.`)
    } catch {
      setNote('Could not build the ZIP — try again.')
    } finally {
      setIsZipping(false)
    }
  }, [isZipping, items])

  if (tier !== 'pro') return null

  return (
    <div className='animate-section-in mt-4 rounded-2xl border border-white/[0.1] bg-white/[0.04] p-4'>
      <div className='flex items-center justify-between gap-2'>
        <h2 className='text-sm font-semibold text-white/85'>Batch download</h2>
        <span className='text-xs text-white/40'>
          {parsedUrls.length}/{MAX_BATCH_URLS} links
        </span>
      </div>

      <textarea
        value={rawInput}
        onChange={(e) => setRawInput(e.target.value)}
        placeholder={`Paste up to ${MAX_BATCH_URLS} links — one per line, or separated by spaces/commas`}
        rows={3}
        disabled={isRunning}
        className='mt-2 w-full resize-y rounded-xl border border-white/[0.1] bg-white/[0.03] p-3 text-sm text-white placeholder-white/40 outline-none focus:border-cyan-400/60 disabled:opacity-60'
      />

      <div className='mt-2 flex flex-wrap items-center gap-2'>
        <button
          type='button'
          onClick={() => void handleStart()}
          disabled={isRunning || parsedUrls.length === 0}
          className='btn-grad btn-press rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50'
        >
          {isRunning ? 'Resolving…' : 'Start batch'}
        </button>

        {isRunning && (
          <button
            type='button'
            onClick={handleCancel}
            className='rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:text-white'
          >
            Cancel
          </button>
        )}

        {zipCandidateCount > 0 && (
          <button
            type='button'
            onClick={() => void handleSaveAll()}
            disabled={isZipping}
            className='rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50'
          >
            {isZipping ? 'Zipping…' : `Save all (${zipCandidateCount})`}
          </button>
        )}
      </div>

      {note && <p className='mt-2 text-xs text-white/50'>{note}</p>}

      {items.length > 0 && (
        <ul className='mt-3 flex flex-col gap-1.5'>
          {items.map((item) => (
            <li
              key={item.url}
              className='animate-section-in flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs'
            >
              <StatusIcon item={item} />
              <span className='min-w-0 flex-1 truncate text-white/70'>{item.url}</span>
              <span className={`shrink-0 font-medium ${rowStatusColorClass(item)}`}>
                {rowStatusText(item)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className='mt-3 text-xs text-white/40'>
        Videos save individually as each one finishes. Photos and audio collect into one ZIP —
        tap “Save all” once the queue is done.
      </p>
    </div>
  )
}
