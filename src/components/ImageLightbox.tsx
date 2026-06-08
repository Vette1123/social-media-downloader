'use client'

import { useEffect, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { DownloadIcon, CloseIcon } from './icons'
import { buildDownloadFilename } from '@/lib/filename'

interface LightboxImage {
  id: string
  url: string
  thumbnail: string
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
}

export function ImageLightbox({
  images,
  activeIndex,
  onClose,
  onPrev,
  onNext,
  platform,
  author,
  title,
}: ImageLightboxProps) {
  const current = images[activeIndex]

  // Render via a portal to <body>. The lightbox uses `position: fixed` to cover
  // the viewport, but an ancestor in the results card has a CSS `transform`
  // (enter animation) which would otherwise become the containing block — that
  // made `inset-0` size to the card instead of the viewport (giant, unscrollable
  // modal). Portaling to body escapes that ancestor entirely.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') onPrev()
      else if (e.key === 'ArrowRight') onNext()
    },
    [onClose, onPrev, onNext],
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

  const handleDownloadOne = async () => {
    try {
      const res = await fetch(current.url)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = buildDownloadFilename({
        platform,
        author,
        title,
        ext: 'jpg',
        index: activeIndex + 1,
        total: images.length,
      })
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
    } catch (err) {
      console.error('Single image download failed:', err)
    }
  }

  if (!current || !mounted) return null

  const hasMultiple = images.length > 1
  const stop = (e: React.MouseEvent) => e.stopPropagation()

  return createPortal(
    // Column layout: fixed top/bottom bars with a flexible image area in
    // between. The image is sized to the remaining space (object-contain), so
    // it's always fully visible and never overflows the viewport — no clipping,
    // no scrolling needed, for portrait or landscape. Clicking the backdrop
    // (any empty space) closes; the image and controls stop propagation.
    <div
      className='fixed inset-0 z-50 flex flex-col bg-black/85 backdrop-blur-md'
      onClick={onClose}
      role='dialog'
      aria-modal='true'
      aria-label='Image preview'
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

      {/* Image area — flexes to fill the space between the bars */}
      <div className='relative flex min-h-0 flex-1 items-center justify-center px-3 sm:px-6'>
        {hasMultiple && (
          <button
            onClick={(e) => {
              stop(e)
              onPrev()
            }}
            className='absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-2xl leading-none text-white transition-colors hover:bg-white/20 sm:left-4 md:h-12 md:w-12'
            aria-label='Previous image'
          >
            ‹
          </button>
        )}

        <img
          src={current.url}
          alt={`Slide ${activeIndex + 1} of ${images.length}`}
          onClick={stop}
          className='max-h-full max-w-full rounded-lg object-contain shadow-2xl'
        />

        {hasMultiple && (
          <button
            onClick={(e) => {
              stop(e)
              onNext()
            }}
            className='absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-2xl leading-none text-white transition-colors hover:bg-white/20 sm:right-4 md:h-12 md:w-12'
            aria-label='Next image'
          >
            ›
          </button>
        )}
      </div>

      {/* Bottom bar: download */}
      <div className='flex shrink-0 items-center justify-center p-4' onClick={stop}>
        <button
          onClick={handleDownloadOne}
          className='flex items-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-500/25 transition-all hover:from-pink-600 hover:to-violet-600'
        >
          <DownloadIcon className='h-4 w-4' />
          Download image
        </button>
      </div>
    </div>,
    document.body,
  )
}
