'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Surface } from '@/components/Surface'
import {
  MAX_BATCH_URLS,
  parseBatchInput,
  runBatch,
  type BatchItem,
  type BatchItemStatus,
} from '@/lib/batchQueue'
import {
  categorizeResult,
  isCancelled,
  isZippable,
  rowStatusColorClass,
  rowStatusText,
} from '@/lib/batchPresentation'
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
 *
 * The pure routing/labeling logic (`categorizeResult`, `isCancelled`,
 * `rowStatusText`, `rowStatusColorClass`) lives in `@/lib/batchPresentation`,
 * not here — it needs to be unit-testable, and this file cannot be (no jsdom
 * in this repo's Vitest config).
 */

// Batch is one format for the whole run, not per-item — the queue has no UI
// real estate for twenty individual toggles, and this is the choice that
// actually matters: TikTok/Instagram creators are exactly the audience this
// feature targets, and audio-only extraction is a common thing to want in
// bulk. Threaded straight into `resolve()`'s existing `format` option.
type BatchFormat = 'video' | 'audio'

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

/**
 * Fetch every zippable (image/audio) "done" item and fold it into one ZIP
 * archive. Callers are expected to have already filtered to
 * `isZippable(categorizeResult(item.result))` — this only branches on
 * 'image'/'audio' and silently skips anything else, so a stray non-zippable
 * item contributes nothing rather than erroring.
 */
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
    if (categorizeResult(item.result) === 'none') {
      return (
        <span aria-hidden className='shrink-0 text-white/50'>
          –
        </span>
      )
    }
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
  const [format, setFormat] = useState<BatchFormat>('video')
  const [items, setItems] = useState<BatchItem[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [isZipping, setIsZipping] = useState(false)
  const [note, setNote] = useState('')

  // Tracks each url's previous status across successive `onUpdate` broadcasts
  // so a video is auto-saved exactly once, on the transition into 'done' —
  // not on every later broadcast that merely repeats it.
  const prevStatusRef = useRef<Map<string, BatchItemStatus>>(new Map())
  const abortRef = useRef<AbortController | null>(null)

  // Auto-height fallback. `field-sizing: content` on the textarea does this
  // natively in Chromium/WebKit with zero JS; this only fires on engines that
  // lack it, and setting an inline height there is safe precisely because
  // field-sizing is unsupported (an inline height would otherwise beat it).
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = textareaRef.current
    if (!el || CSS.supports('field-sizing', 'content')) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [rawInput])

  const parsedUrls = useMemo(() => parseBatchInput(rawInput), [rawInput])

  const zipCandidateCount = useMemo(
    () =>
      items.filter(
        (item) => item.status === 'done' && isZippable(categorizeResult(item.result)),
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
        (url, signal) => resolve(url, { format, proToken, signal }),
        handleUpdate,
        controller.signal,
      )
    } finally {
      setIsRunning(false)
      abortRef.current = null
    }
  }, [format, handleUpdate, isRunning, parsedUrls, proToken])

  const handleCancel = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const handleSaveAll = useCallback(async () => {
    const zipCandidates = items.filter(
      (item) => item.status === 'done' && isZippable(categorizeResult(item.result)),
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
    <Surface elevation='raised' className='animate-section-in mt-4 p-4'>
      <div className='flex items-center justify-between gap-2'>
        <h2 className='text-sm font-semibold text-white/85'>Batch download</h2>
        <span className='text-xs text-white/50'>
          {parsedUrls.length}/{MAX_BATCH_URLS} links
        </span>
      </div>

      {/* The well is a Surface, not a hand-rolled border+fill, so the focus ring
          is the same `--surface-line` tween the paste bar uses. Growth is
          `field-sizing: content` (the effect above only covers engines without
          it), so the box is exactly as tall as the pasted list up to max-h. */}
      <Surface
        radius='xl'
        className='mt-2 transition-colors duration-200 focus-within:[--surface-line:rgba(34,211,238,0.55)] focus-within:shadow-[0_0_18px_-6px_rgba(34,211,238,0.35)]'
      >
        <textarea
          ref={textareaRef}
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          placeholder={`Paste up to ${MAX_BATCH_URLS} links, one per line or separated by spaces/commas`}
          aria-label='Batch links'
          disabled={isRunning}
          className='field-sizing-content block max-h-64 min-h-24 w-full resize-none overflow-y-auto rounded-xl bg-transparent p-3 text-sm leading-relaxed text-white caret-cyan-300 outline-none selection:bg-cyan-400/25 placeholder:text-white/40 disabled:opacity-60'
        />
      </Surface>

      {/* One format for the whole batch — see the BatchFormat comment above
          for why this isn't per-item. */}
      <div className='mt-2 flex items-center gap-2 text-xs'>
        <span className='text-white/50'>Format</span>
        <div
          role='group'
          aria-label='Batch download format'
          className='inline-flex rounded-full border border-white/10 bg-white/[0.03] p-0.5'
        >
          {(['video', 'audio'] as const).map((f) => (
            <button
              key={f}
              type='button'
              onClick={() => setFormat(f)}
              disabled={isRunning}
              aria-pressed={format === f}
              className={`rounded-full px-3 py-1 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                format === f ? 'bg-cyan-400/90 text-[#04171b]' : 'text-white/55 hover:text-white'
              }`}
            >
              {f === 'video' ? 'Video' : 'Audio (MP3)'}
            </button>
          ))}
        </div>
      </div>

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

      <p className='mt-3 text-xs text-white/50'>
        {format === 'video'
          ? 'Videos save individually as each one finishes. Photos collect into one ZIP — tap “Save all” once the queue is done.'
          : 'Audio tracks collect into one ZIP — tap “Save all” once the queue is done. A link with nothing downloadable (e.g. a playable-only embed) is marked as such, not as a failure.'}
      </p>
    </Surface>
  )
}
