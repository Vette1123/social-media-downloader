'use client'

import { beginDownload } from '@/lib/analytics'
import { useEffect, useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, type PanInfo } from 'motion/react'
import {
  DownloadIcon,
  CloseIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from './icons'
import { buildDownloadFilename } from '@/lib/filename'
import { useHydrated } from '@/lib/clientEnv'

interface LightboxImage {
  id: string
  url: string
  thumbnail: string
  /** A carousel slide can be a clip. Absent means image. */
  kind?: 'image' | 'video'
}

interface ImageLightboxProps {
  images: LightboxImage[]
  activeIndex: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
  platform?: string
  author?: string
  title?: string
  /** A supporter’s saved-filename shape, passed down rather than re-derived. */
  filenameTemplate?: string
}

// Direction-aware slide variants. `direction` is +1 when paginating forward
// (next) and -1 when paginating back (prev); the entering image slides in from
// the side the user swiped from, and the exiting image slides out the opposite
// way — so the motion always reads as "follow the finger."
const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? '100%' : '-100%',
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction < 0 ? '100%' : '-100%',
    opacity: 0,
  }),
}

// Either a long-enough drag OR a fast-enough flick triggers pagination. Two
// independent thresholds (not a multiplied "power") so a slow careful drag
// still navigates once the user clearly commits past the halfway mark.
const OFFSET_THRESHOLD = 80
const VELOCITY_THRESHOLD = 400

// What TAB may cycle through while the lightbox is open. Only elements that
// are actually laid out count — the guard removes anything display:none.
const FOCUSABLE =
  'button:not([disabled]), [href], input, select, video, [tabindex]:not([tabindex="-1"])'

export function ImageLightbox({
  images,
  activeIndex,
  onClose,
  onPrev,
  onNext,
  platform,
  author,
  title,
  filenameTemplate,
}: ImageLightboxProps) {
  const current = images[activeIndex]
  const hasMultiple = images.length > 1
  const isVideo = current?.kind === 'video'

  // Render via a portal to <body>. The lightbox uses `position: fixed` to cover
  // the viewport, but an ancestor in the results card has a CSS `transform`
  // (enter animation) which would otherwise become the containing block — that
  // made `inset-0` size to the card instead of the viewport. Portaling escapes
  // that ancestor entirely.
  // `document` only exists after hydration, so the portal can't be created on
  // the first render pass — see lib/clientEnv for why this isn't an effect.
  const mounted = useHydrated()

  // A dialog that declares aria-modal must keep the modifier keys it promised:
  // without a trap, TAB walks straight out into the dimmed page underneath,
  // where focus sits hidden behind the lightbox and a sighted keyboard user is
  // steering a screen they cannot see. Mounted on the fixed root (below), so
  // the loop stays inside the dialog.
  const dialogRef = useRef<HTMLDivElement>(null)
  // Focus flows back to whatever opened the lightbox when it closes — the
  // gallery thumbnail that was clicked. Without the return, the caret is left
  // on a portal node that has been removed from the tree and the next TAB
  // starts from the top of the document.
  const previouslyFocused = useRef<HTMLElement | null>(null)
  const dialogOpen = !!current && mounted

  useEffect(() => {
    if (!dialogOpen) return
    previouslyFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    // The dialog root takes initial focus (tabIndex -1): pressing TAB once
    // lands on the close button, and the announcement reads the aria-label.
    dialogRef.current?.focus()
    return () => {
      previouslyFocused.current?.focus()
      previouslyFocused.current = null
    }
  }, [dialogOpen])

  // Track direction so AnimatePresence's enter/exit slides the right way.
  // Update it just before calling onNext/onPrev — React batches both updates so
  // `direction` is already correct when the new activeIndex re-renders.
  const [direction, setDirection] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const paginate = useCallback(
    (dir: 1 | -1) => {
      setDirection(dir)
      if (dir === 1) onNext()
      else onPrev()
    },
    [onNext, onPrev],
  )

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key === 'Tab') {
        // Trap the loop: whichever side the caret enters from, it wraps to the
        // other end of the dialog's own focusables instead of escaping into
        // the dimmed page. shift+TAB wraps backwards the same way.
        const root = dialogRef.current
        if (!root) return
        const focusables = Array.from(
          root.querySelectorAll<HTMLElement>(FOCUSABLE),
        ).filter((el) => el.offsetWidth > 0 || el.offsetHeight > 0)
        if (focusables.length === 0) return
        e.preventDefault()
        const active = document.activeElement
        const index = focusables.indexOf(active as HTMLElement)
        let nextIndex: number
        if (e.shiftKey) {
          nextIndex = index <= 0 ? focusables.length - 1 : index - 1
        } else {
          nextIndex = index === focusables.length - 1 ? 0 : index + 1
        }
        focusables[nextIndex].focus()
        return
      }
      if (!hasMultiple) return
      // The browser's own video controls bind the arrow keys to seeking. With
      // a clip focused, one press would otherwise both scrub the video and
      // change the slide out from under it.
      if ((e.target as HTMLElement | null)?.closest?.('video')) return
      if (e.key === 'ArrowLeft') paginate(-1)
      else if (e.key === 'ArrowRight') paginate(1)
    },
    [onClose, paginate, hasMultiple],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKey)
      document.body.style.overflow = prevOverflow
    }
  }, [handleKey])

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    setIsDragging(false)
    const { offset, velocity } = info
    if (offset.x < -OFFSET_THRESHOLD || velocity.x < -VELOCITY_THRESHOLD) {
      paginate(1)
    } else if (offset.x > OFFSET_THRESHOLD || velocity.x > VELOCITY_THRESHOLD) {
      paginate(-1)
    }
    // Otherwise the image springs back to 0 automatically (constraints 0/0).
  }

  const handleBackdropClick = () => {
    // A pointerup that ends a drag can synthesize a click — don't close then.
    if (isDragging) return
    onClose()
  }

  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')

  const handleDownloadOne = async () => {
    if (downloading) return
    setDownloading(true)
    setDownloadError('')
    const transfer = beginDownload('lightbox_image', {
      platform,
      content_title: title,
      content_author: author,
    })
    try {
      const res = await fetch(current.url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = buildDownloadFilename({
        platform,
        author,
        title,
        // A carousel slide is whatever it is. Naming a clip `.jpg` produced a
        // file the operating system opened in an image viewer.
        ext: isVideo ? 'mp4' : 'jpg',
        index: activeIndex + 1,
        total: images.length,
        template: filenameTemplate,
      })
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
      transfer.completed({ size_bytes: blob.size })
    } catch (err) {
      console.error('Single slide download failed:', err)
      transfer.failed(err)
      setDownloadError('That file would not download. Try again.')
    } finally {
      setDownloading(false)
    }
  }

  if (!current || !mounted) return null

  const stop = (e: React.MouseEvent) => e.stopPropagation()

  return createPortal(
    <div
      ref={dialogRef}
      tabIndex={-1}
      className='fixed inset-0 z-50 flex flex-col bg-black/85 backdrop-blur-md outline-none'
      onClick={handleBackdropClick}
      role='dialog'
      aria-modal='true'
      aria-label='Media preview'
    >
      {/* Top bar: counter + close */}
      <div
        className='flex shrink-0 items-center justify-between gap-3 p-4'
        onClick={stop}
      >
        <span className='rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white tabular-nums'>
          {activeIndex + 1} / {images.length}
        </span>
        <button
          onClick={(e) => {
            stop(e)
            onClose()
          }}
          className='flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 transition-colors hover:bg-white/20'
          aria-label='Close preview'
        >
          <CloseIcon className='h-5 w-5' />
        </button>
      </div>

      {/* Image area. `overflow-hidden` clips the exiting image as it slides off
          so it never bleeds into the bars. `touch-action: pan-y` lets us own
          horizontal swipes while letting the browser keep any vertical panning. */}
      <div
        className='relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-3 sm:px-6'
        style={{ touchAction: 'pan-y' }}
      >
        {hasMultiple && (
          <button
            onClick={(e) => {
              stop(e)
              paginate(-1)
            }}
            className='absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/10 transition-colors hover:bg-white/20 sm:left-4 md:h-12 md:w-12'
            aria-label='Previous slide'
          >
            <ChevronLeftIcon className='h-5 w-5 md:h-6 md:w-6' />
          </button>
        )}

        {/* `popLayout` removes the exiting slide from layout flow so the new one
            takes the centered slot immediately — no flex-stacking jump.
            A clip is never draggable: the drag would swallow every touch aimed
            at the scrubber, so a video slide paginates by arrow, swipe on the
            surrounding area, or keyboard. */}
        <AnimatePresence initial={false} custom={direction} mode='popLayout'>
          <motion.div
            key={activeIndex}
            custom={direction}
            variants={slideVariants}
            initial='enter'
            animate='center'
            exit='exit'
            transition={{
              x: { type: 'spring', stiffness: 280, damping: 32, mass: 0.6 },
              opacity: { duration: 0.18 },
            }}
            drag={hasMultiple && !isVideo ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={1}
            dragMomentum={false}
            onDragStart={() => setIsDragging(true)}
            onDragEnd={handleDragEnd}
            onClick={stop}
            className='flex max-h-full max-w-full items-center justify-center'
          >
            {isVideo ? (
              <video
                src={current.url}
                poster={current.thumbnail || undefined}
                controls
                playsInline
                preload='metadata'
                className='max-h-full max-w-full rounded-lg bg-black shadow-2xl'
              />
            ) : (
              <img
                src={current.url}
                alt={`Slide ${activeIndex + 1} of ${images.length}`}
                draggable={false}
                className='max-h-full max-w-full cursor-grab rounded-lg object-contain shadow-2xl select-none active:cursor-grabbing'
              />
            )}
          </motion.div>
        </AnimatePresence>

        {hasMultiple && (
          <button
            onClick={(e) => {
              stop(e)
              paginate(1)
            }}
            className='absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/10 transition-colors hover:bg-white/20 sm:right-4 md:h-12 md:w-12'
            aria-label='Next slide'
          >
            <ChevronRightIcon className='h-5 w-5 md:h-6 md:w-6' />
          </button>
        )}
      </div>

      {/* Bottom bar: download */}
      <div
        className='flex shrink-0 flex-col items-center justify-center gap-2 p-4'
        onClick={stop}
      >
        <button
          onClick={handleDownloadOne}
          disabled={downloading}
          className='btn-grad flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-[box-shadow,transform] hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60'
        >
          <DownloadIcon className='h-4 w-4' />
          {downloading
            ? 'Downloading…'
            : isVideo
              ? 'Download video'
              : 'Download image'}
        </button>
        {downloadError && (
          <p role='status' className='text-xs text-rose-300'>
            {downloadError}
          </p>
        )}
      </div>
    </div>,
    document.body,
  )
}
