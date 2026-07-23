'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import {
  appReducer,
  initialState,
  type VideoMetadata,
} from '@/lib/appReducer'
import {
  CheckIcon,
  ClipboardIcon,
  ClockIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FacebookIcon,
  getImagePlaceholderBase64,
  InstagramIcon,
  MusicIcon,
  SpinnerIcon,
  TikTokIcon,
  TrashIcon,
  TwitterXIcon,
  YouTubeIcon,
} from '@/components/icons'
import { InstallPrompt } from '@/components/InstallPrompt'
import { buildDownloadFilename } from '@/lib/filename'
import { friendlyError } from '@/lib/errorMessages'
import {
  addHistory,
  clearHistory,
  loadHistory,
  removeHistory,
  type HistoryEntry,
} from '@/lib/history'

// Pull the first http(s) URL out of arbitrary shared text. Android's share sheet
// often hands a link inside `text` wrapped in a caption ("check this out <url>"),
// so we scan for the first URL token rather than assume the whole string is one.
function extractFirstUrl(s: string): string | null {
  if (!s) return null
  const m = s.match(/https?:\/\/[^\s]+/i)
  const candidate = (m ? m[0] : s).trim()
  return /^https?:\/\//i.test(candidate) ? candidate : null
}

// Pull EVERY http(s) URL out of pasted text, de-duplicated in order. Powers
// batch mode: paste a list (one per line, or space-separated) and each link is
// resolved and saved to Recent in turn.
function extractAllUrls(s: string): string[] {
  if (!s) return []
  const matches = s.match(/https?:\/\/[^\s]+/gi) || []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of matches) {
    const u = raw.trim()
    if (u && !seen.has(u)) {
      seen.add(u)
      out.push(u)
    }
  }
  return out
}

// Stream a download response, reporting progress as it lands. Emits a 0–100
// percentage when the response carries a Content-Length; otherwise emits null
// (indeterminate) and lets the browser buffer. Buffering the chunks here is no
// heavier than response.blob(), which also holds the whole body in memory — it
// just lets us surface a real progress bar on big mobile downloads.
async function streamToBlob(
  response: Response,
  onProgress: (pct: number | null) => void,
): Promise<Blob> {
  const total = Number(response.headers.get('content-length')) || 0
  const type = response.headers.get('content-type') || ''
  if (!response.body || !total) {
    onProgress(null)
    const blob = await response.blob()
    onProgress(100)
    return blob
  }
  const reader = response.body.getReader()
  const chunks: BlobPart[] = []
  let received = 0
  onProgress(0)
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(value)
      received += value.length
      onProgress(Math.min(99, Math.round((received / total) * 100)))
    }
  }
  onProgress(100)
  return new Blob(chunks, type ? { type } : undefined)
}

// Capture a tiny, self-contained snapshot of a thumbnail for the Recent list.
// Loads the image through our same-origin /api/image proxy (which sets CORS +
// the right Referer for hotlink-gated CDNs), downscales it onto a canvas, and
// returns a ~96px JPEG data URL. Storing the pixels means Recent thumbnails
// never go blank later when a signed CDN URL expires or blocks hotlinking.
// Returns '' on any failure so the caller can fall back to a platform tile.
async function snapshotImage(srcUrl: string): Promise<string> {
  if (!srcUrl || typeof document === 'undefined') return ''
  const src = srcUrl.startsWith('/')
    ? srcUrl
    : `/api/image?url=${encodeURIComponent(srcUrl)}`
  return new Promise((resolve) => {
    const img = document.createElement('img')
    img.crossOrigin = 'anonymous'
    const timer = window.setTimeout(() => resolve(''), 8000)
    img.onload = () => {
      window.clearTimeout(timer)
      try {
        const max = 96
        const scale =
          Math.min(max / img.naturalWidth, max / img.naturalHeight, 1) || 1
        const w = Math.max(1, Math.round(img.naturalWidth * scale))
        const h = Math.max(1, Math.round(img.naturalHeight * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve('')
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.72))
      } catch {
        resolve('') // tainted canvas / decode failure — fall back to a tile
      }
    }
    img.onerror = () => {
      window.clearTimeout(timer)
      resolve('')
    }
    img.src = src
  })
}

// Capture a persistent thumbnail for the Recent list. Tries the client canvas
// snapshot first (compact, downscaled), and falls back to the server /api/thumb
// route when the canvas path fails — an old browser that taints the canvas, a
// decode error, or a CDN the browser can't send the right Referer to. Either
// way the returned value is a self-contained data URL, so the Recent thumbnail
// survives the source URL expiring. Returns '' when nothing worked (→ tile).
async function captureThumbnail(srcUrl: string): Promise<string> {
  if (!srcUrl) return ''
  const snap = await snapshotImage(srcUrl)
  if (snap) return snap
  // Server fallback needs the original remote URL, not our proxy wrapper.
  const proxyPrefix = '/api/image?url='
  const raw = srcUrl.startsWith(proxyPrefix)
    ? decodeURIComponent(srcUrl.slice(proxyPrefix.length))
    : srcUrl
  if (!/^https?:\/\//i.test(raw)) return ''
  try {
    const res = await fetch(`/api/thumb?url=${encodeURIComponent(raw)}`)
    if (res.ok) {
      const data = (await res.json()) as { dataUrl?: string | null }
      if (typeof data?.dataUrl === 'string' && data.dataUrl) return data.dataUrl
    }
  } catch {
    // network/parse failure — fall through to the tile.
  }
  return ''
}

// Hand a URL straight to the browser's download manager via a synthetic <a>.
// Used for Cobalt tunnel URLs (Content-Disposition: attachment, cross-origin
// safe), so the bytes go browser→Cobalt directly instead of being re-streamed
// through our function. The `download` filename is advisory (browsers ignore it
// cross-origin and honour Cobalt's own attachment filename); target=_blank is a
// safety net so a browser that somehow navigates opens a tab instead of
// replacing the app shell.
function triggerDirectDownload(url: string, filename: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  link.target = '_blank'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

const PLATFORM_DISPLAY: Record<string, string> = {
  tiktok: 'TikTok',
  twitter: 'X',
  instagram: 'Instagram',
  facebook: 'Facebook',
  youtube: 'YouTube',
  pinterest: 'Pinterest',
  reddit: 'Reddit',
  threads: 'Threads',
  snapchat: 'Snapchat',
  twitch: 'Twitch',
  vimeo: 'Vimeo',
}

// Never store a raw URL or "Untitled" as a Recent title — fall back to a clean
// "<Platform> video" label so the list reads like content, not plumbing.
function friendlyTitle(rawTitle: string | undefined, platform?: string): string {
  const t = (rawTitle || '').trim()
  if (t && !/^https?:\/\//i.test(t) && !/^untitled$/i.test(t)) return t
  const name = platform ? PLATFORM_DISPLAY[platform] : ''
  return name ? `${name} video` : 'Saved link'
}

// Branded fallback tile for a Recent entry with no usable snapshot. IG/FB/YT
// icons are full-colour badges that fill the tile; the rest render as a glyph on
// a neutral chip.
function PlatformTile({ platform }: { platform?: HistoryEntry['platform'] }) {
  const badges: Partial<
    Record<string, React.ComponentType<{ className?: string }>>
  > = {
    instagram: InstagramIcon,
    facebook: FacebookIcon,
    youtube: YouTubeIcon,
  }
  const glyphs: Partial<
    Record<string, React.ComponentType<{ className?: string }>>
  > = {
    tiktok: TikTokIcon,
    twitter: TwitterXIcon,
  }
  const Badge = platform ? badges[platform] : undefined
  if (Badge) return <Badge className='h-full w-full' />
  const Glyph = (platform && glyphs[platform]) || ExternalLinkIcon
  return (
    <span className='flex h-full w-full items-center justify-center bg-white/[0.06] text-white/55'>
      <Glyph className='h-4 w-4' />
    </span>
  )
}

// The lightbox is the ONLY component that genuinely needs the motion library
// (drag/swipe + AnimatePresence). It's buried deep behind "Show images" → tap a
// thumbnail, so it is never in the critical path. Lazy-loading it splits the
// ~69KB motion chunk out of the initial bundle — it only downloads the first
// time a user actually opens a carousel image. A cheap inline placeholder keeps
// the layout stable while the chunk streams in.
const ImageLightbox = dynamic(
  () => import('@/components/ImageLightbox').then((m) => m.ImageLightbox),
  {
    ssr: false,
    loading: () => null,
  },
)

// Shown the instant "Process URL" is hit, filling the results column with a
// shaped placeholder so the card doesn't pop in cold ~1.5s later. Its outline
// matches the real result (thumbnail + title, a toggle, a tile grid, and the
// two download buttons) so the swap to real content reads as fill-in, not a
// late appearance.
function ResultsSkeleton() {
  return (
    <div
      aria-hidden
      className='animate-fade-in-up space-y-4 rounded-2xl border border-white/[0.1] bg-white/[0.04] p-4'
    >
      <div className='flex items-start gap-3'>
        <div className='h-16 w-16 shrink-0 animate-pulse rounded-lg bg-white/[0.07] md:h-20 md:w-20' />
        <div className='flex-1 space-y-2 pt-1'>
          <div className='h-4 w-3/4 animate-pulse rounded bg-white/[0.07]' />
          <div className='h-3 w-2/5 animate-pulse rounded bg-white/[0.06]' />
          <div className='h-3 w-1/4 animate-pulse rounded bg-white/[0.05]' />
        </div>
      </div>
      <div className='h-11 w-full animate-pulse rounded-xl bg-white/[0.05]' />
      <div className='grid grid-cols-3 gap-3'>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className='aspect-square animate-pulse rounded-xl bg-white/[0.05]'
          />
        ))}
      </div>
      <div className='grid grid-cols-2 gap-3'>
        <div className='h-11 animate-pulse rounded-xl bg-white/[0.06]' />
        <div className='h-11 animate-pulse rounded-xl bg-white/[0.05]' />
      </div>
    </div>
  )
}

export function DownloaderApp() {
  const [state, dispatch] = useReducer(appReducer, initialState)
  const containerRef = useRef<HTMLDivElement>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [urlError, setUrlError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const pasteBarRef = useRef<HTMLDivElement>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [quality, setQuality] = useState<'hd' | 'sd'>('hd')
  const [format, setFormat] = useState<'video' | 'audio'>('video')
  // Batch progress while resolving a pasted list of links; null when idle.
  const [batch, setBatch] = useState<{
    done: number
    total: number
    saved: number
  } | null>(null)
  // Which rendition the result-card re-pick is currently fetching (null = idle).
  const [repicking, setRepicking] = useState<'hd' | 'sd' | 'audio' | null>(null)
  // iPhone/iPad Safari: downloads land in Files, not the camera roll, so we show
  // a one-line "save to Photos" hint on video results. Set once on mount.
  const [isIOS, setIsIOS] = useState(false)
  const didInit = useRef(false)

  const changeQuality = (q: 'hd' | 'sd') => {
    setQuality(q)
    try {
      window.localStorage.setItem('smd:quality', q)
    } catch {
      // storage disabled — the choice still applies for this session.
    }
  }

  const changeFormat = (f: 'video' | 'audio') => {
    setFormat(f)
    try {
      window.localStorage.setItem('smd:format', f)
    } catch {
      // storage disabled — the choice still applies for this session.
    }
  }

  // Resolve one link against the API. Shared by the single-link flow, batch
  // mode, and the result-card re-pick. `opts` overrides the current format/
  // quality prefs so the re-pick can request a different rendition without
  // waiting for a setState round-trip. Returns the parsed response (or throws
  // on network failure).
  const resolveOne = async (
    target: string,
    opts?: { quality?: 'hd' | 'sd'; format?: 'video' | 'audio' },
  ) => {
    const response = await fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: target,
        type: state.downloadType,
        quality: opts?.quality ?? quality,
        format: opts?.format ?? format,
      }),
    })
    return response.json()
  }

  // Snapshot the thumbnail off the main flow and prepend the link to Recent so
  // the card always shows an image (even after the source URL expires) and the
  // title never reads as a raw link.
  const rememberInHistory = async (
    target: string,
    meta: {
      title?: string
      author?: string
      platform?: HistoryEntry['platform']
      thumbnail?: string
    },
  ) => {
    const snap = await captureThumbnail(meta?.thumbnail || '')
    setHistory(
      addHistory({
        url: target,
        title: friendlyTitle(meta?.title, meta?.platform),
        author: meta?.author || '',
        platform: meta?.platform,
        thumbnail: snap || meta?.thumbnail || '',
        ts: Date.now(),
      }),
    )
  }

  // Re-resolve the current result at a different rendition (HD / Data saver /
  // MP3) without making the user re-paste. Keeps the card on screen (no reset),
  // updates the saved prefs so the top toggles stay in sync, and swaps in the
  // fresh result. `repicking` marks the pending chip so the control can show a
  // spinner and lock out double-taps.
  const reResolve = async (
    nextFormat: 'video' | 'audio',
    nextQuality: 'hd' | 'sd',
  ) => {
    const target = state.originalUrl
    if (!target || repicking) return
    // Persist the new prefs so the paste-bar toggles and next resolve match.
    if (nextFormat !== format) changeFormat(nextFormat)
    if (nextQuality !== quality) changeQuality(nextQuality)
    setRepicking(nextFormat === 'audio' ? 'audio' : nextQuality)
    setUrlError(null)
    try {
      const data = await resolveOne(target, {
        quality: nextQuality,
        format: nextFormat,
      })
      if (data.success) {
        dispatch({
          type: 'SET_DOWNLOAD_SUCCESS',
          payload: {
            downloadUrl: data.downloadUrl,
            audioUrl: data.audioUrl,
            metadata: data.metadata,
            originalUrl: target,
          },
        })
        void rememberInHistory(target, data.metadata)
      } else {
        const fe = friendlyError(data.error, target)
        dispatch({ type: 'SET_MESSAGE', payload: `${fe.title} — ${fe.hint}` })
      }
    } catch (err) {
      const fe = friendlyError(err instanceof Error ? err.message : '', target)
      dispatch({ type: 'SET_MESSAGE', payload: `${fe.title} — ${fe.hint}` })
    } finally {
      setRepicking(null)
    }
  }

  // `overrideUrl` lets the paste button, the PWA share target, and the recent
  // list kick off a resolve without waiting for a state round-trip through the
  // input. When omitted we use whatever's in the field.
  const handleProcess = async (overrideUrl?: string) => {
    const target = (overrideUrl ?? state.url).trim()
    if (!target) {
      setUrlError(
        'Please paste a TikTok, Twitter/X, Instagram, Facebook, or YouTube URL first',
      )
      return
    }

    // Batch: a pasted list of links resolves each in turn (see processBatch).
    // The paste button / share target pass a single overrideUrl and skip this.
    if (overrideUrl === undefined) {
      const urls = extractAllUrls(target)
      if (urls.length > 1) {
        void processBatch(urls)
        return
      }
    }

    if (overrideUrl !== undefined) {
      dispatch({ type: 'SET_URL', payload: overrideUrl })
    }
    setUrlError(null)

    dispatch({ type: 'SET_LOADING', payload: true })
    dispatch({ type: 'RESET_DOWNLOAD_STATE' })

    try {
      const data = await resolveOne(target)

      if (data.success) {
        dispatch({
          type: 'SET_DOWNLOAD_SUCCESS',
          payload: {
            downloadUrl: data.downloadUrl,
            audioUrl: data.audioUrl,
            metadata: data.metadata,
            originalUrl: target,
          },
        })

        // Remember it locally (one-tap re-open), off the main flow.
        void rememberInHistory(target, data.metadata)

        dispatch({ type: 'SET_URL', payload: '' })

        setTimeout(() => {
          if (containerRef.current) {
            const resultsSection =
              containerRef.current.querySelector('.results-section')
            if (resultsSection) {
              resultsSection.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              })
            }
          }
        }, 500)
      } else {
        const fe = friendlyError(data.error, target)
        dispatch({
          type: 'SET_MESSAGE',
          payload: `${fe.title} — ${fe.hint}`,
        })
      }
    } catch (err) {
      console.error('Processing error:', err)
      const fe = friendlyError(err instanceof Error ? err.message : '', target)
      dispatch({
        type: 'SET_MESSAGE',
        payload: `${fe.title} — ${fe.hint}`,
      })
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }

  // Resolve a pasted list of links one at a time (sequential keeps load light on
  // the public extractor). Each success is saved to Recent; the last one also
  // fills the result card so there's something to act on immediately, and a
  // summary line reports how many landed.
  const processBatch = async (urls: string[]) => {
    setUrlError(null)
    dispatch({ type: 'RESET_DOWNLOAD_STATE' })
    dispatch({ type: 'SET_LOADING', payload: true })
    setBatch({ done: 0, total: urls.length, saved: 0 })

    let saved = 0
    let last: { data: unknown; target: string } | null = null

    for (let i = 0; i < urls.length; i++) {
      setBatch({ done: i, total: urls.length, saved })
      try {
        const data = await resolveOne(urls[i])
        if (data.success) {
          saved++
          await rememberInHistory(urls[i], data.metadata)
          last = { data, target: urls[i] }
        }
      } catch {
        // skip this link — keep going through the rest of the batch.
      }
    }

    setBatch(null)
    dispatch({ type: 'SET_LOADING', payload: false })

    if (last) {
      const data = last.data as {
        downloadUrl?: string
        audioUrl?: string
        metadata: VideoMetadata
      }
      dispatch({
        type: 'SET_DOWNLOAD_SUCCESS',
        payload: {
          downloadUrl: data.downloadUrl,
          audioUrl: data.audioUrl,
          metadata: data.metadata,
          originalUrl: last.target,
        },
      })
    }
    dispatch({ type: 'SET_URL', payload: '' })
    dispatch({
      type: 'SET_MESSAGE',
      payload:
        saved > 0
          ? `Saved ${saved} of ${urls.length} links to Recent — tap any to download. 🎉`
          : `Couldn’t resolve any of those ${urls.length} links. Check they’re public post URLs and try again.`,
    })
  }

  // One-tap paste: read the clipboard, and if it holds a link, resolve it
  // immediately. Falls back to filling the field (or focusing it, when the
  // browser blocks programmatic clipboard reads) so the user is never stuck.
  const handlePaste = async () => {
    if (!navigator.clipboard?.readText) {
      inputRef.current?.focus()
      setUrlError('Long-press the field and choose Paste.')
      return
    }
    try {
      const text = await navigator.clipboard.readText()
      const found = extractFirstUrl(text)
      if (found) {
        handleProcess(found)
      } else if (text.trim()) {
        dispatch({ type: 'SET_URL', payload: text.trim() })
        inputRef.current?.focus()
        setUrlError('That doesn’t look like a link — paste a post URL.')
      } else {
        inputRef.current?.focus()
      }
    } catch {
      inputRef.current?.focus()
      setUrlError('Couldn’t read the clipboard — paste the link manually.')
    }
  }

  const handleClearHistory = () => {
    clearHistory()
    setHistory([])
  }

  // Runs once on mount: hydrate the recent list from localStorage, and honour a
  // PWA share-target / deep link (?url= / ?text=). Sharing a link straight from
  // the TikTok/IG/YouTube app lands here — we auto-resolve it and strip the
  // query so a refresh doesn't fire it again.
  useEffect(() => {
    if (didInit.current) return
    didInit.current = true
    setHistory(loadHistory())
    // iOS (real Safari, not Chrome/Firefox on iOS which spoof a desktop-ish UA):
    // downloads go to Files, so a "save to Photos" hint helps. iPadOS 13+ reports
    // a Mac UA, so also treat a touch-capable "Mac" as iPad.
    try {
      const ua = window.navigator.userAgent || ''
      const iOSUA = /iphone|ipad|ipod/i.test(ua) && !/crios|fxios/i.test(ua)
      const iPadOS =
        /Macintosh/i.test(ua) && (navigator.maxTouchPoints ?? 0) > 1
      if (iOSUA || iPadOS) setIsIOS(true)
    } catch {
      // non-browser / locked-down env — skip the hint.
    }
    try {
      const q = window.localStorage.getItem('smd:quality')
      if (q === 'sd' || q === 'hd') setQuality(q)
      const f = window.localStorage.getItem('smd:format')
      if (f === 'audio' || f === 'video') setFormat(f)
    } catch {
      // ignore — default HD video.
    }
    try {
      const params = new URLSearchParams(window.location.search)
      const shared = params.get('url') || params.get('text') || ''
      const found = extractFirstUrl(shared)
      if (found) {
        window.history.replaceState(null, '', window.location.pathname)
        handleProcess(found)
      }
    } catch {
      // no-op — malformed query, just show the normal empty state.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleVideoDownload = async () => {
    if (!state.downloadUrl) return

    // Direct path: a Cobalt tunnel downloads browser→Cobalt, skipping our proxy
    // (saves the function's egress). No progress bar — the browser's own
    // download manager takes over instantly.
    const direct = state.videoMetadata?.directVideoUrl
    if (direct) {
      triggerDirectDownload(
        direct,
        buildDownloadFilename({
          platform: state.videoMetadata?.platform,
          author: state.videoMetadata?.author,
          title: state.videoMetadata?.title,
          ext: 'mp4',
        }),
      )
      dispatch({
        type: 'SET_MESSAGE',
        payload: 'Download started. Check your downloads. 🎉',
      })
      return
    }

    dispatch({ type: 'SET_DOWNLOADING', payload: true })
    dispatch({ type: 'SET_PROGRESS', payload: 0 })

    try {
      const response = await fetch(state.downloadUrl)

      if (!response.ok) {
        throw new Error('Failed to download video')
      }
      const blob = await streamToBlob(response, (p) =>
        dispatch({ type: 'SET_PROGRESS', payload: p }),
      )
      const blobUrl = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = blobUrl
      link.download = buildDownloadFilename({
        platform: state.videoMetadata?.platform,
        author: state.videoMetadata?.author,
        title: state.videoMetadata?.title,
        ext: 'mp4',
      })
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      URL.revokeObjectURL(blobUrl)

      dispatch({
        type: 'SET_MESSAGE',
        payload: 'Video downloaded successfully! 🎉',
      })
      dispatch({ type: 'SET_URL', payload: '' })
    } catch (error) {
      console.error('Download failed:', error)
      dispatch({
        type: 'SET_MESSAGE',
        payload: 'Failed to download video file',
      })
    } finally {
      dispatch({ type: 'SET_DOWNLOADING', payload: false })
      dispatch({ type: 'SET_PROGRESS', payload: null })
    }
  }

  const handleSlideshowRender = async () => {
    const images = state.videoMetadata?.images
    const rawMusicUrl = state.videoMetadata?.rawMusicUrl
    if (!images || images.length === 0) return

    dispatch({ type: 'SET_DOWNLOADING', payload: true })
    dispatch({
      type: 'SET_MESSAGE',
      payload: 'Rendering slideshow video... this takes ~30 seconds.',
    })

    try {
      const response = await fetch('/api/slideshow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrls: images.map((img) => img.url),
          audioUrl: rawMusicUrl,
          perImageSeconds: 3,
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to render slideshow')
      }

      const blob = await streamToBlob(response, (p) =>
        dispatch({ type: 'SET_PROGRESS', payload: p }),
      )
      const blobUrl = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = blobUrl
      link.download = buildDownloadFilename({
        platform: state.videoMetadata?.platform,
        author: state.videoMetadata?.author,
        title: state.videoMetadata?.title,
        ext: 'mp4',
      })
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)

      dispatch({
        type: 'SET_MESSAGE',
        payload: 'Slideshow video rendered and downloaded! 🎬',
      })
      dispatch({ type: 'SET_URL', payload: '' })
    } catch (error) {
      console.error('Slideshow render failed:', error)
      dispatch({
        type: 'SET_MESSAGE',
        payload:
          error instanceof Error
            ? `Slideshow render failed: ${error.message}`
            : 'Failed to render slideshow video',
      })
    } finally {
      dispatch({ type: 'SET_DOWNLOADING', payload: false })
      dispatch({ type: 'SET_PROGRESS', payload: null })
    }
  }

  const handleAudioDownload = async () => {
    if (!state.audioUrl) return

    // Direct path: a Cobalt audio tunnel (MP3) downloads browser→Cobalt,
    // bypassing our proxy. Only set when the audio source is itself a tunnel
    // (the "→ MP3" flow); re-serving a video stream as audio keeps the proxy.
    const direct = state.videoMetadata?.directAudioUrl
    if (direct) {
      triggerDirectDownload(
        direct,
        buildDownloadFilename({
          platform: state.videoMetadata?.platform,
          author: state.videoMetadata?.author,
          title: state.videoMetadata?.title,
          ext: 'mp3',
        }),
      )
      dispatch({
        type: 'SET_MESSAGE',
        payload: 'Download started. Check your downloads. 🎵',
      })
      return
    }

    dispatch({ type: 'SET_DOWNLOADING_AUDIO', payload: true })
    dispatch({ type: 'SET_PROGRESS', payload: 0 })

    try {
      const response = await fetch(state.audioUrl)

      if (!response.ok) {
        throw new Error('Failed to download audio')
      }
      const blob = await streamToBlob(response, (p) =>
        dispatch({ type: 'SET_PROGRESS', payload: p }),
      )
      const blobUrl = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = blobUrl
      link.download = buildDownloadFilename({
        platform: state.videoMetadata?.platform,
        author: state.videoMetadata?.author,
        title: state.videoMetadata?.title,
        ext: 'mp3',
      })
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      URL.revokeObjectURL(blobUrl)

      dispatch({
        type: 'SET_MESSAGE',
        payload: 'Audio downloaded successfully! 🎵',
      })
      dispatch({ type: 'SET_URL', payload: '' })
    } catch (error) {
      console.error('Audio download failed:', error)
      dispatch({
        type: 'SET_MESSAGE',
        payload: 'Failed to download audio file',
      })
    } finally {
      dispatch({ type: 'SET_DOWNLOADING_AUDIO', payload: false })
      dispatch({ type: 'SET_PROGRESS', payload: null })
    }
  }

  const handleImageDownload = async () => {
    if (!state.videoMetadata?.images) return

    const selectedImages = state.videoMetadata.images.filter(
      (img) => img.selected,
    )

    if (selectedImages.length === 0) {
      dispatch({
        type: 'SET_MESSAGE',
        payload: 'Please select at least one image to download',
      })
      return
    }

    dispatch({ type: 'SET_DOWNLOADING_IMAGES', payload: true })

    try {
      const imageUrls = selectedImages.map((img) => img.url)

      if (state.downloadImagesAsZip) {
        dispatch({ type: 'SET_PROGRESS', payload: 0 })
        const response = await fetch('/api/images', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            imageUrls,
            title: state.videoMetadata.title,
            asZip: true,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to download images as ZIP')
        }
        const blob = await streamToBlob(response, (p) =>
          dispatch({ type: 'SET_PROGRESS', payload: p }),
        )
        const blobUrl = URL.createObjectURL(blob)

        const link = document.createElement('a')
        link.href = blobUrl
        link.download = buildDownloadFilename({
          platform: state.videoMetadata?.platform,
          author: state.videoMetadata?.author,
          title: state.videoMetadata?.title,
          ext: 'zip',
        })
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)

        URL.revokeObjectURL(blobUrl)

        dispatch({
          type: 'SET_MESSAGE',
          payload: `${selectedImages.length} image(s) downloaded as ZIP! 🗜️`,
        })
        dispatch({ type: 'SET_URL', payload: '' })
      } else {
        const response = await fetch('/api/images', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            imageUrls,
            asZip: false,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to get image download URLs')
        }

        const data = await response.json()

        if (!data.success || !data.images) {
          throw new Error('Invalid response from server')
        }

        const totalImages = data.images.length
        for (let i = 0; i < data.images.length; i++) {
          const imageData = data.images[i]
          try {
            const imageResponse = await fetch(imageData.url)
            if (!imageResponse.ok) continue

            const blob = await imageResponse.blob()
            const blobUrl = URL.createObjectURL(blob)

            const link = document.createElement('a')
            link.href = blobUrl
            link.download = buildDownloadFilename({
              platform: state.videoMetadata?.platform,
              author: state.videoMetadata?.author,
              title: state.videoMetadata?.title,
              ext: 'jpg',
              index: i + 1,
              total: totalImages,
            })
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)

            URL.revokeObjectURL(blobUrl)

            await new Promise((resolve) => setTimeout(resolve, 500))
          } catch (error) {
            console.error('Failed to download individual image:', error)
          }
        }
        dispatch({
          type: 'SET_MESSAGE',
          payload: `${selectedImages.length} image(s) downloaded individually! 🖼️`,
        })
        dispatch({ type: 'SET_URL', payload: '' })
      }
    } catch (error) {
      console.error('Image download failed:', error)
      dispatch({
        type: 'SET_MESSAGE',
        payload: 'Failed to download images',
      })
    } finally {
      dispatch({ type: 'SET_DOWNLOADING_IMAGES', payload: false })
      dispatch({ type: 'SET_PROGRESS', payload: null })
    }
  }

  const toggleImageGallery = () => {
    dispatch({ type: 'TOGGLE_IMAGE_GALLERY' })
  }

  const toggleImageSelection = (imageId: string) => {
    dispatch({ type: 'TOGGLE_IMAGE_SELECTION', payload: imageId })
  }

  const selectAllImages = (selected: boolean) => {
    dispatch({ type: 'SELECT_ALL_IMAGES', payload: selected })
  }

  const togglePreview = () => {
    dispatch({ type: 'TOGGLE_PREVIEW' })
  }

  // Keyboard-aware paste bar — the web equivalent of RN's KeyboardAvoidingView.
  // The soft keyboard doesn't reflow the page; it shrinks the *visual* viewport
  // and overlays the bottom, so a paste bar sitting low in the hero ends up
  // hidden behind it. visualViewport.height is the real post-keyboard height:
  // if the bar's bottom sits below the visible band, scroll the page up by
  // exactly that overlap (+ breathing room) so it rises above the keys.
  //
  // Measure the whole PASTE BAR, not just the input: on mobile the Download
  // button stacks *below* the field (flex-col), so scrolling only the input
  // into view left the button — the thing the user actually taps — still
  // buried under the keyboard. getBoundingClientRect() on the container spans
  // input + button, so both clear the keys.
  const keepInputAboveKeyboard = useCallback(() => {
    const bar = pasteBarRef.current
    const vv = window.visualViewport
    if (!bar || !vv) return
    const rect = bar.getBoundingClientRect()
    const visibleBottom = vv.height + vv.offsetTop
    const overshoot = rect.bottom - visibleBottom + 24
    if (overshoot > 0) {
      window.scrollBy({ top: overshoot, behavior: 'smooth' })
    }
  }, [])

  // The keyboard slide-up fires a visualViewport 'resize' — recentre then, when
  // the final height is known, but only while our field holds focus.
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const onResize = () => {
      if (document.activeElement === inputRef.current) keepInputAboveKeyboard()
    }
    vv.addEventListener('resize', onResize)
    return () => vv.removeEventListener('resize', onResize)
  }, [keepInputAboveKeyboard])

  return (
    <div ref={containerRef} className='mx-auto w-full max-w-2xl'>
      {/* Paste bar — the hero action. Input + CTA share one focus-ring pill. */}
      <div
        ref={pasteBarRef}
        className={`flex flex-col gap-2 rounded-2xl border bg-white/[0.04] p-2 transition-colors duration-200 sm:flex-row ${
          urlError
            ? 'border-red-400/60'
            : 'border-white/[0.1] focus-within:border-cyan-400/60'
        }`}
      >
        <div className='relative flex min-w-0 flex-1 items-center'>
          <input
            ref={inputRef}
            type='url'
            inputMode='url'
            enterKeyHint='go'
            autoCapitalize='none'
            autoCorrect='off'
            autoComplete='off'
            spellCheck={false}
            placeholder='Paste a video link…'
            value={state.url}
            onChange={(e) => {
              if (urlError) setUrlError(null)
              dispatch({ type: 'SET_URL', payload: e.target.value })
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleProcess()
              }
            }}
            onFocus={() => {
              // Fallback for browsers that raise the keyboard without a
              // visualViewport 'resize' — nudge after the slide-up settles.
              window.setTimeout(keepInputAboveKeyboard, 300)
            }}
            aria-invalid={urlError ? 'true' : 'false'}
            aria-describedby={urlError ? 'url-error' : undefined}
            className='min-w-0 flex-1 rounded-xl bg-transparent px-4 py-3 pr-[4.75rem] text-base text-white placeholder-white/40 outline-none'
          />
          {/* One-tap paste — only while the field is empty, so it never overlaps
              a link the user is typing. Reads the clipboard and auto-resolves. */}
          {!state.url && (
            <button
              type='button'
              onClick={handlePaste}
              aria-label='Paste link from clipboard'
              className='absolute right-1.5 flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-xs font-medium text-white/70 transition-colors hover:border-cyan-400/40 hover:text-white active:scale-95'
            >
              <ClipboardIcon className='h-3.5 w-3.5' />
              Paste
            </button>
          )}
        </div>
        <button
          onClick={() => handleProcess()}
          disabled={
            state.loading ||
            state.downloading ||
            state.downloadingAudio ||
            state.downloadingImages
          }
          className='btn-grad btn-press group relative flex shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl px-6 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 md:text-base'
        >
          <span
            className='pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-1000 ease-out group-hover:translate-x-full'
            aria-hidden
          />
          {state.loading ? (
            <span className='relative flex items-center'>
              <SpinnerIcon className='-ml-1 mr-2 h-4 w-4 md:h-5 md:w-5' />
              Processing...
            </span>
          ) : (
            <span className='relative'>Download</span>
          )}
        </button>
      </div>

      {urlError && (
        <p
          id='url-error'
          role='alert'
          className='animate-section-in mt-2 flex items-center gap-1.5 text-xs text-red-300 md:text-sm'
        >
          <span aria-hidden>⚠</span>
          {urlError}
        </p>
      )}

      <p className='mt-3 text-center text-xs text-white/45'>
        Videos, reels, shorts, MP3 audio &amp; photo carousels — paste several
        links to grab them in one go
      </p>

      {/* Format + quality preferences — applied on the next resolve. Format
          picks video vs. audio-only (MP3); quality affects sources with a
          quality knob (most videos) and is irrelevant for audio, so it's hidden
          in audio mode. */}
      <div className='mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs'>
        <div className='flex items-center gap-2'>
          <span className='text-white/40'>Format</span>
          <div
            role='group'
            aria-label='Download format'
            className='inline-flex rounded-full border border-white/10 bg-white/[0.03] p-0.5'
          >
            {(['video', 'audio'] as const).map((f) => (
              <button
                key={f}
                type='button'
                onClick={() => changeFormat(f)}
                aria-pressed={format === f}
                className={`rounded-full px-3 py-1 font-medium transition-colors ${
                  format === f
                    ? 'bg-cyan-400/90 text-[#04171b]'
                    : 'text-white/55 hover:text-white'
                }`}
              >
                {f === 'video' ? 'Video' : 'Audio (MP3)'}
              </button>
            ))}
          </div>
        </div>

        {format === 'video' && (
          <div className='flex items-center gap-2'>
            <span className='text-white/40'>Quality</span>
            <div
              role='group'
              aria-label='Preferred video quality'
              className='inline-flex rounded-full border border-white/10 bg-white/[0.03] p-0.5'
            >
              {(['hd', 'sd'] as const).map((q) => (
                <button
                  key={q}
                  type='button'
                  onClick={() => changeQuality(q)}
                  aria-pressed={quality === q}
                  className={`rounded-full px-3 py-1 font-medium transition-colors ${
                    quality === q
                      ? 'bg-cyan-400/90 text-[#04171b]'
                      : 'text-white/55 hover:text-white'
                  }`}
                >
                  {q === 'hd' ? 'HD' : 'Data saver'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent — locally-stored links (never leaves the device). Hidden once a
          result is on screen so it doesn't compete with it. Tap to re-resolve. */}
      {history.length > 0 && !state.videoMetadata && !state.loading && (
        <div className='animate-section-in mt-4'>
          <div className='mb-2 flex items-center justify-between'>
            <span className='flex items-center gap-1.5 text-xs font-medium text-white/50'>
              <ClockIcon className='h-3.5 w-3.5' />
              Recent
            </span>
            <button
              type='button'
              onClick={handleClearHistory}
              className='flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-white/40 transition-colors hover:text-white/80'
            >
              <TrashIcon className='h-3 w-3' />
              Clear
            </button>
          </div>
          <ul
            className={`space-y-1.5 ${
              showAllHistory ? 'max-h-72 overflow-y-auto pr-1' : ''
            }`}
          >
            {(showAllHistory ? history : history.slice(0, 5)).map((h) => (
              <li key={h.url} className='relative'>
                <button
                  type='button'
                  onClick={() => handleProcess(h.url)}
                  className='group flex w-full items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.03] py-1.5 pr-9 pl-2 text-left transition-colors hover:border-cyan-400/30 hover:bg-white/[0.05]'
                >
                  {/* Branded tile sits underneath; the snapshot (a self-contained
                      data URL) overlays it. If a legacy remote thumb ever fails,
                      onError removes it and the tile shows through. */}
                  <span className='relative h-9 w-9 shrink-0 overflow-hidden rounded-md'>
                    <PlatformTile platform={h.platform} />
                    {h.thumbnail && (
                      <img
                        src={
                          h.thumbnail.startsWith('data:')
                            ? h.thumbnail
                            : `/api/image?url=${encodeURIComponent(h.thumbnail)}`
                        }
                        alt=''
                        className='absolute inset-0 h-full w-full object-cover'
                        loading='lazy'
                        decoding='async'
                        onError={(e) => e.currentTarget.remove()}
                      />
                    )}
                  </span>
                  <span className='min-w-0 flex-1'>
                    <span className='block truncate text-xs text-white/80'>
                      {h.title}
                    </span>
                    <span className='block truncate text-[10px] text-white/40'>
                      {h.author ||
                        (h.platform ? PLATFORM_DISPLAY[h.platform] : '') ||
                        'Saved link'}
                    </span>
                  </span>
                </button>
                <button
                  type='button'
                  onClick={() => setHistory(removeHistory(h.url))}
                  aria-label={`Remove ${h.title} from recent`}
                  className='absolute top-1/2 right-1.5 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-md text-white/30 transition-colors hover:bg-white/10 hover:text-white/70'
                >
                  <span aria-hidden className='text-base leading-none'>
                    ×
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {history.length > 5 && (
            <button
              type='button'
              onClick={() => setShowAllHistory((v) => !v)}
              className='mt-2 w-full rounded-lg border border-white/[0.06] py-1.5 text-center text-[11px] font-medium text-white/50 transition-colors hover:border-cyan-400/30 hover:text-white/80'
            >
              {showAllHistory ? 'Show less' : `View all (${history.length})`}
            </button>
          )}
        </div>
      )}

      {/* Install nudge — secondary, so it sits below the paste bar, controls and
          Recent rather than interrupting the core flow. Installing registers the
          Android share target (share a link straight from TikTok/IG/YouTube). */}
      {!state.videoMetadata && !state.loading && <InstallPrompt />}

      {/* Results — expand directly under the paste bar.
          scroll-mt-24: the success handler calls scrollIntoView({block:'start'}),
          which pins this section flush to the viewport top. On mobile the
          collapsing address bar overlays that strip and eats the card header
          ("top disappears"). scroll-margin-top leaves ~6rem so the header always
          clears the browser chrome. */}
      <div className='results-section mt-6 space-y-4 scroll-mt-24'>
        {state.message && (
          // Plain conditional + CSS reveal. key={message} remounts on new text
          // so the entrance re-fires as state feedback. No height animation to
          // stall, no 0-height ghost left in the space-y flow.
          <div
            key={state.message}
            role='status'
            aria-live='polite'
            className={`animate-section-in p-3 rounded-xl text-center text-sm md:text-base ${
              state.message.includes('success') ||
              state.message.includes('🎉') ||
              state.message.includes('🎵') ||
              state.message.includes('🎬')
                ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                : 'bg-red-500/20 text-red-300 border border-red-500/30'
            }`}
          >
            {state.message}
          </div>
        )}

        {/* Batch mode: show a compact per-link progress line instead of the
            single-result skeleton while a pasted list resolves. */}
        {batch && (
          <div
            className='animate-section-in space-y-2 rounded-2xl border border-white/[0.1] bg-white/[0.04] p-4'
            role='status'
            aria-live='polite'
          >
            <div className='flex items-center justify-between text-sm text-white/80'>
              <span className='flex items-center gap-2'>
                <SpinnerIcon className='h-4 w-4' />
                Resolving link {Math.min(batch.done + 1, batch.total)} of{' '}
                {batch.total}…
              </span>
              <span className='text-xs text-white/50'>{batch.saved} saved</span>
            </div>
            <div className='h-1.5 w-full overflow-hidden rounded-full bg-white/10'>
              <div
                className='h-full rounded-full bg-gradient-to-r from-cyan-400 to-sky-400 transition-[width] duration-200 ease-out'
                style={{
                  width: `${Math.round((batch.done / batch.total) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {state.loading && !batch && !state.videoMetadata && <ResultsSkeleton />}

          {state.videoMetadata && (
            // CSS entrance (not framer initial:opacity-0). On mobile the main
            // thread is busy decoding carousel images, which starves framer's
            // rAF animation-start and leaves the card stuck at opacity:0 for
            // seconds. animate-card-enter runs on the compositor and never
            // drops below 0.6 opacity, so the card is always visible.
            <div className='animate-card-enter p-4 bg-white/[0.04] rounded-2xl border border-white/[0.1] space-y-4'>
              <div className='flex items-start space-x-3'>
                {state.videoMetadata.thumbnail && (
                  <img
                    src={state.videoMetadata.thumbnail}
                    alt='Video thumbnail'
                    className='w-16 h-16 md:w-20 md:h-20 rounded-lg object-cover flex-shrink-0'
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                )}
                <div className='flex-1 min-w-0'>
                  <h3 className='text-white font-medium text-sm md:text-base line-clamp-2'>
                    {state.videoMetadata.title}
                  </h3>
                  <p className='text-white/70 text-xs md:text-sm mt-1'>
                    by {state.videoMetadata.author}
                  </p>
                  {state.videoMetadata.duration > 0 && (
                    <p className='text-white/50 text-xs mt-1'>
                      {Math.floor(state.videoMetadata.duration / 60)}:
                      {(state.videoMetadata.duration % 60)
                        .toString()
                        .padStart(2, '0')}
                    </p>
                  )}
                  {state.originalUrl &&
                    (() => {
                      const platform = state.videoMetadata?.platform
                      const platformConfig: Partial<
                        Record<
                          NonNullable<typeof platform>,
                          {
                            label: string
                            Icon: React.ComponentType<{ className?: string }>
                            color: string
                          }
                        >
                      > = {
                        tiktok: {
                          label: 'View on TikTok',
                          Icon: TikTokIcon,
                          color: 'text-pink-400 hover:text-pink-300',
                        },
                        twitter: {
                          label: 'View on Twitter/X',
                          Icon: TwitterXIcon,
                          color: 'text-sky-400 hover:text-sky-300',
                        },
                        instagram: {
                          label: 'View on Instagram',
                          Icon: InstagramIcon,
                          color: 'text-fuchsia-400 hover:text-fuchsia-300',
                        },
                        facebook: {
                          label: 'View on Facebook',
                          Icon: FacebookIcon,
                          color: 'text-blue-400 hover:text-blue-300',
                        },
                        youtube: {
                          label: 'View on YouTube',
                          Icon: YouTubeIcon,
                          color: 'text-red-400 hover:text-red-300',
                        },
                      }
                      const fallback = {
                        label: 'View original post',
                        Icon: ExternalLinkIcon,
                        color: 'text-cyan-400 hover:text-cyan-300',
                      }
                      const cfg =
                        (platform && platformConfig[platform]) || fallback
                      return (
                        <a
                          href={state.originalUrl}
                          target='_blank'
                          rel='noopener noreferrer'
                          className={`inline-flex items-center gap-1 mt-2 text-xs transition-colors underline underline-offset-2 break-all ${cfg.color}`}
                        >
                          <cfg.Icon className='w-3 h-3 flex-shrink-0' />
                          {cfg.label}
                        </a>
                      )
                    })()}
                </div>
              </div>

              {/* Preview Toggle (downloadable video or embed-only fallback) */}
              {(state.downloadUrl || state.videoMetadata?.embedUrl) && (
                <button
                  onClick={togglePreview}
                  className='btn-ghost btn-press w-full cursor-pointer py-2.5 px-4 font-semibold rounded-xl flex items-center justify-center text-sm md:text-base'
                >
                  <span className='relative'>
                    {state.showPreview ? 'Hide preview' : 'Show preview'}
                  </span>
                </button>
              )}

              {/* Video Preview (direct stream). For YouTube we prefer the
                  lightweight embed below so previewing doesn't trigger a full
                  yt-dlp download. */}
              {state.showPreview &&
                state.downloadUrl &&
                !state.videoMetadata?.embedUrl && (
                  <div className='animate-section-in space-y-3'>
                    <div className='bg-black rounded-xl overflow-hidden ring-1 ring-inset ring-white/10 shadow-lg'>
                      <video
                        src={state.downloadUrl}
                        poster={state.videoMetadata?.thumbnail || undefined}
                        controls
                        playsInline
                        className='w-full h-auto max-h-[60vh] object-contain bg-black'
                        preload='metadata'
                        onError={(e) => {
                          console.error('Video preview error:', e)
                          dispatch({
                            type: 'SET_MESSAGE',
                            payload:
                              'Preview unavailable, but download should work',
                          })
                        }}
                      >
                        Your browser does not support the video tag.
                      </video>
                    </div>
                    <p className='text-white/50 text-xs text-center'>
                      Preview loaded — ready to download.
                    </p>
                  </div>
                )}

              {/* YouTube embed fallback — playable but not downloadable. Shown
                  when free extraction is blocked so the video stays viewable. */}
              {state.showPreview && state.videoMetadata?.embedUrl && (
                <div className='animate-section-in space-y-3'>
                  <div className='relative bg-black rounded-xl overflow-hidden ring-1 ring-inset ring-white/10 shadow-lg aspect-video'>
                    <iframe
                      src={state.videoMetadata.embedUrl}
                      title={state.videoMetadata.title || 'YouTube video'}
                      allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
                      allowFullScreen
                      referrerPolicy='strict-origin-when-cross-origin'
                      className='absolute inset-0 h-full w-full'
                    />
                  </div>
                  <p className='text-white/50 text-xs text-center'>
                    {state.downloadUrl
                      ? 'Preview via YouTube — use the buttons below to download.'
                      : 'Playing via YouTube — direct download isn’t available for this video.'}
                  </p>
                </div>
              )}

              {/* Photo Carousel Audio Preview */}
              {state.videoMetadata?.isPhotoCarousel && state.audioUrl && (
                <div className='animate-fade-in-up space-y-3 bg-gradient-to-br from-cyan-500/10 to-sky-500/10 rounded-xl p-4 border border-white/[0.1]'>
                  <div className='flex items-center gap-2 text-white'>
                    <MusicIcon className='w-5 h-5 text-cyan-300' />
                    <div className='flex-1 min-w-0'>
                      <p className='text-sm font-semibold truncate'>
                        {state.videoMetadata.musicTitle ||
                          'Slideshow soundtrack'}
                      </p>
                      {state.videoMetadata.musicAuthor && (
                        <p className='text-xs text-white/60 truncate'>
                          by {state.videoMetadata.musicAuthor}
                        </p>
                      )}
                    </div>
                  </div>
                  <audio
                    src={state.audioUrl}
                    controls
                    preload='metadata'
                    className='w-full'
                  >
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}

              {/* Image Gallery */}
              {state.videoMetadata?.images &&
                state.videoMetadata.images.length > 0 && (
                  <div className='space-y-3'>
                    <button
                      onClick={toggleImageGallery}
                      className='btn-ghost btn-press w-full cursor-pointer py-2.5 px-4 font-semibold rounded-xl flex items-center justify-center text-sm md:text-base'
                    >
                      <span className='relative'>
                        {state.showImageGallery
                          ? 'Hide images'
                          : `Show images (${state.videoMetadata.images.length})`}
                      </span>
                    </button>

                    {state.showImageGallery && (
                      // No height animation — a big image grid is exactly what
                      // starved framer's rAF on mobile and left the gallery
                      // collapsed/invisible. CSS reveal is instant, compositor-
                      // only, and can't be stalled. px-1 gives the selected
                      // tiles' inset cyan ring breathing room from the edge.
                      <div className='animate-section-in space-y-3 px-1'>
                        <div className='flex items-center justify-between bg-white/[0.03] border border-white/[0.08] rounded-lg p-3'>
                          <span className='text-white text-sm'>
                            Select images to download:
                          </span>
                          <div className='flex space-x-2'>
                            <button
                              onClick={() => selectAllImages(true)}
                              className='btn-grad cursor-pointer px-3 py-1 text-xs font-semibold rounded-md transition-[box-shadow] duration-200'
                            >
                              All
                            </button>
                            <button
                              onClick={() => selectAllImages(false)}
                              className='btn-ghost cursor-pointer px-3 py-1 text-xs font-medium rounded-md transition-colors'
                            >
                              None
                            </button>
                          </div>
                        </div>

                        <div className='grid grid-cols-2 sm:grid-cols-3 gap-3'>
                          {state.videoMetadata.images.map((image, index) => (
                            // Wrapper is positioning-only (no ring/overflow) so
                            // badges can overlay; the ring lives on the image
                            // button itself — same element as the rounding, so
                            // the outline aligns pixel-perfect to the corners.
                            // `ring-inset` is essential: an OUTWARD ring is a
                            // box-shadow painted outside the element, and this
                            // grid's collapse wrapper (the height-animated
                            // `overflow-hidden` motion.div) would slice that
                            // outward ring off the left/right edge tiles —
                            // permanently for selected tiles and on hover (when
                            // it thickens 1px→2px). An inset ring renders inside
                            // the element's own box, so no ancestor clip can
                            // ever cut it, in any state.
                            <div key={image.id} className='group relative'>
                              <button
                                type='button'
                                onClick={() => setLightboxIndex(index)}
                                className={`flex aspect-square w-full cursor-zoom-in items-center justify-center overflow-hidden rounded-xl bg-black/30 ring-inset transition duration-200 ${
                                  image.selected
                                    ? 'ring-2 ring-cyan-400'
                                    : 'ring-1 ring-white/10 hover:ring-2 hover:ring-white/60'
                                }`}
                                aria-label={`Open image ${index + 1} full size`}
                              >
                                {/* object-contain shows the whole image (never
                                    cropped). No hover scale — scaling a
                                    contained image past the cell would clip it
                                    (overflow-hidden) and look cropped on hover. */}
                                <img
                                  src={image.thumbnail}
                                  alt={`Slideshow image ${index + 1}`}
                                  className='h-full w-full object-contain'
                                  loading='lazy'
                                  decoding='async'
                                  onError={(e) => {
                                    e.currentTarget.src =
                                      getImagePlaceholderBase64()
                                  }}
                                />
                              </button>

                              <button
                                type='button'
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleImageSelection(image.id)
                                }}
                                aria-pressed={image.selected}
                                aria-label={
                                  image.selected
                                    ? `Deselect image ${index + 1}`
                                    : `Select image ${index + 1}`
                                }
                                className={`absolute top-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 backdrop-blur-sm transition-all duration-200 ${
                                  image.selected
                                    ? 'border-cyan-400 bg-cyan-400 text-[#04171b]'
                                    : 'border-white/50 bg-black/40 hover:border-white hover:bg-black/60'
                                }`}
                              >
                                {image.selected && (
                                  <CheckIcon className='h-4 w-4 text-[#04171b]' />
                                )}
                              </button>

                              <div className='pointer-events-none absolute top-1.5 left-1.5 rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-white'>
                                {index + 1}
                              </div>

                              <div className='pointer-events-none absolute inset-x-1.5 bottom-1.5 rounded bg-black/40 px-1.5 py-0.5 text-center text-[10px] text-white/80 opacity-0 transition-opacity group-hover:opacity-100'>
                                Click to preview
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className='bg-white/[0.03] border border-white/[0.08] rounded-lg p-3 space-y-3'>
                          <div className='flex items-center space-x-3'>
                            <input
                              type='checkbox'
                              id='downloadAsZip'
                              checked={state.downloadImagesAsZip}
                              onChange={(e) =>
                                dispatch({
                                  type: 'SET_DOWNLOAD_IMAGES_AS_ZIP',
                                  payload: e.target.checked,
                                })
                              }
                              className='w-4 h-4 accent-cyan-400 bg-white/10 border-white/30 rounded focus:ring-cyan-400 focus:ring-2'
                            />
                            <label
                              htmlFor='downloadAsZip'
                              className='text-white text-sm cursor-pointer'
                            >
                              Download as ZIP file
                            </label>
                          </div>
                          <p className='text-white/60 text-xs'>
                            {state.downloadImagesAsZip
                              ? 'Images will be packaged into a single ZIP file'
                              : 'Images will be downloaded individually'}
                          </p>
                        </div>

                        <button
                          onClick={handleImageDownload}
                          disabled={
                            state.downloadingImages ||
                            !state.videoMetadata?.images?.some(
                              (img) => img.selected,
                            )
                          }
                          className='btn-grad w-full cursor-pointer py-3 px-4 disabled:opacity-50 disabled:cursor-not-allowed font-semibold rounded-xl transition-[box-shadow,transform] duration-200 flex items-center justify-center text-sm md:text-base gap-2'
                        >
                          {state.downloadingImages ? (
                            <>
                              <SpinnerIcon className='flex-shrink-0 h-4 w-4' />
                              <span>Downloading...</span>
                            </>
                          ) : (
                            <>
                              <DownloadIcon className='flex-shrink-0 h-5 w-5' />
                              <span>
                                Download Selected (
                                {state.videoMetadata?.images?.filter(
                                  (img) => img.selected,
                                ).length || 0}
                                )
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}

              {/* Re-pick rendition — re-resolve the SAME link as HD / Data
                  saver / MP3 without making the user re-paste. Hidden for photo
                  carousels and embed-only results (no single stream to swap). */}
              {(() => {
                const meta = state.videoMetadata
                const hasStream = !!state.downloadUrl || !!state.audioUrl
                const isGallery =
                  meta?.isPhotoCarousel || (meta?.images?.length ?? 0) > 0
                if (!hasStream || isGallery) return null
                const active: 'hd' | 'sd' | 'audio' =
                  format === 'audio' ? 'audio' : quality
                const options: Array<{
                  key: 'hd' | 'sd' | 'audio'
                  label: string
                  onPick: () => void
                }> = [
                  { key: 'hd', label: 'HD', onPick: () => reResolve('video', 'hd') },
                  {
                    key: 'sd',
                    label: 'Data saver',
                    onPick: () => reResolve('video', 'sd'),
                  },
                  {
                    key: 'audio',
                    label: 'MP3',
                    onPick: () => reResolve('audio', quality),
                  },
                ]
                return (
                  <div className='flex items-center justify-center gap-2 text-xs'>
                    <span className='text-white/40'>Get it as</span>
                    <div
                      role='group'
                      aria-label='Re-download as'
                      className='inline-flex rounded-full border border-white/10 bg-white/[0.03] p-0.5'
                    >
                      {options.map((o) => {
                        const isActive = active === o.key
                        const isPending = repicking === o.key
                        return (
                          <button
                            key={o.key}
                            type='button'
                            onClick={o.onPick}
                            disabled={repicking !== null}
                            aria-pressed={isActive}
                            className={`flex items-center gap-1 rounded-full px-3 py-1 font-medium transition-colors disabled:cursor-not-allowed ${
                              isActive
                                ? 'bg-cyan-400/90 text-[#04171b]'
                                : 'text-white/55 hover:text-white disabled:opacity-50'
                            }`}
                          >
                            {isPending && <SpinnerIcon className='h-3 w-3' />}
                            {o.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {/* Download Buttons */}
              {(() => {
                const hasImagesForSlideshow =
                  state.videoMetadata?.isPhotoCarousel &&
                  (state.videoMetadata?.images?.length ?? 0) > 0
                const showVideoButton =
                  !!state.downloadUrl || hasImagesForSlideshow
                const showAudioButton = !!state.audioUrl
                if (!showVideoButton && !showAudioButton) return null
                return (
                  <div
                    className={`grid gap-3 ${
                      showVideoButton && showAudioButton
                        ? 'grid-cols-1 md:grid-cols-2'
                        : 'grid-cols-1'
                    }`}
                  >
                    {showVideoButton && (
                      <button
                        onClick={
                          state.downloadUrl
                            ? handleVideoDownload
                            : handleSlideshowRender
                        }
                        disabled={
                          state.downloading || state.downloadingImages
                        }
                        className='btn-grad btn-press group relative py-3 cursor-pointer px-4 disabled:opacity-50 disabled:cursor-not-allowed font-semibold rounded-xl flex items-center justify-center text-sm md:text-base gap-2 overflow-hidden'
                      >
                        <span
                          className='pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-1000 ease-out'
                          aria-hidden
                        />
                        {state.downloading ? (
                          <span className='relative flex items-center gap-2'>
                            <SpinnerIcon className='flex-shrink-0 h-4 w-4' />
                            <span>
                              {state.videoMetadata?.isPhotoCarousel &&
                              !state.downloadUrl
                                ? 'Rendering...'
                                : 'Downloading...'}
                            </span>
                          </span>
                        ) : (
                          <span className='relative flex items-center gap-2'>
                            <DownloadIcon className='flex-shrink-0 h-5 w-5' />
                            <span>
                              {state.videoMetadata?.isPhotoCarousel
                                ? 'Video (slideshow)'
                                : 'Video'}
                            </span>
                          </span>
                        )}
                      </button>
                    )}

                    {showAudioButton && (
                      <button
                        onClick={handleAudioDownload}
                        disabled={
                          state.downloadingAudio || state.downloadingImages
                        }
                        className='btn-ghost btn-press py-3 cursor-pointer px-4 disabled:opacity-50 disabled:cursor-not-allowed font-semibold rounded-xl flex items-center justify-center text-sm md:text-base gap-2'
                      >
                        {state.downloadingAudio ? (
                          <span className='relative flex items-center gap-2'>
                            <SpinnerIcon className='flex-shrink-0 h-4 w-4' />
                            <span>Downloading...</span>
                          </span>
                        ) : (
                          <span className='relative flex items-center gap-2'>
                            <MusicIcon className='flex-shrink-0 h-5 w-5' />
                            <span>
                              {state.videoMetadata?.isPhotoCarousel
                                ? 'Download Audio'
                                : 'Extract Audio'}
                            </span>
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                )
              })()}

              {/* iOS: video downloads land in Files, not the camera roll, so
                  point users at the one extra tap that saves to Photos. Only for
                  a real video stream (MP3/Files-only downloads don't need it). */}
              {isIOS &&
                !!state.downloadUrl &&
                !state.videoMetadata?.isPhotoCarousel && (
                  <p className='text-center text-[11px] leading-relaxed text-white/45'>
                    On iPhone it saves to Files. To add it to Photos, open the
                    file, tap Share, then Save Video.
                  </p>
                )}

              {(state.downloadUrl || state.audioUrl) &&
                (() => {
                  const isDownloading =
                    state.downloading ||
                    state.downloadingAudio ||
                    state.downloadingImages
                  if (!isDownloading) {
                    return (
                      <p className='text-white/50 text-xs text-center'>
                        Click to download your content
                      </p>
                    )
                  }
                  const pct = state.progress
                  return (
                    <div
                      className='space-y-1.5'
                      role='status'
                      aria-live='polite'
                    >
                      <div className='h-1.5 w-full overflow-hidden rounded-full bg-white/10'>
                        {pct === null ? (
                          <div className='animate-progress-indeterminate h-full w-1/3 rounded-full bg-gradient-to-r from-cyan-400 to-sky-400' />
                        ) : (
                          <div
                            className='h-full rounded-full bg-gradient-to-r from-cyan-400 to-sky-400 transition-[width] duration-150 ease-out'
                            style={{ width: `${pct}%` }}
                          />
                        )}
                      </div>
                      <p className='text-center text-xs text-white/50'>
                        {pct === null
                          ? 'Preparing your download…'
                          : `Downloading… ${pct}%`}
                      </p>
                    </div>
                  )
                })()}
            </div>
          )}
        </div>

      {lightboxIndex !== null && state.videoMetadata?.images && (
        <ImageLightbox
          images={state.videoMetadata.images}
          activeIndex={lightboxIndex}
          platform={state.videoMetadata.platform}
          author={state.videoMetadata.author}
          title={state.videoMetadata.title}
          onClose={() => setLightboxIndex(null)}
          onPrev={() =>
            setLightboxIndex((i) => {
              const total = state.videoMetadata?.images?.length ?? 0
              if (i === null || total === 0) return i
              return (i - 1 + total) % total
            })
          }
          onNext={() =>
            setLightboxIndex((i) => {
              const total = state.videoMetadata?.images?.length ?? 0
              if (i === null || total === 0) return i
              return (i + 1) % total
            })
          }
        />
      )}
    </div>
  )
}
