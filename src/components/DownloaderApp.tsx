'use client'

import { useReducer, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { appReducer, initialState } from '@/lib/appReducer'
import {
  CheckIcon,
  DownloadIcon,
  FacebookIcon,
  getImagePlaceholderBase64,
  InstagramIcon,
  MusicIcon,
  SpinnerIcon,
  TikTokIcon,
  TwitterXIcon,
  YouTubeIcon,
} from '@/components/icons'
import { ImageLightbox } from '@/components/ImageLightbox'
import { buildDownloadFilename } from '@/lib/filename'

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

  const handleProcess = async () => {
    if (!state.url.trim()) {
      setUrlError(
        'Please paste a TikTok, Twitter/X, Instagram, Facebook, or YouTube URL first',
      )
      return
    }
    setUrlError(null)

    dispatch({ type: 'SET_LOADING', payload: true })
    dispatch({ type: 'RESET_DOWNLOAD_STATE' })

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: state.url,
          type: state.downloadType,
        }),
      })

      const data = await response.json()

      if (data.success) {
        dispatch({
          type: 'SET_DOWNLOAD_SUCCESS',
          payload: {
            downloadUrl: data.downloadUrl,
            audioUrl: data.audioUrl,
            metadata: data.metadata,
            originalUrl: state.url,
          },
        })

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
        dispatch({
          type: 'SET_MESSAGE',
          payload: data.error || 'Failed to process video',
        })
      }
    } catch (err) {
      console.error('Processing error:', err)
      dispatch({
        type: 'SET_MESSAGE',
        payload: 'An error occurred while processing the video',
      })
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }

  const handleVideoDownload = async () => {
    if (!state.downloadUrl) return

    dispatch({ type: 'SET_DOWNLOADING', payload: true })

    try {
      const response = await fetch(state.downloadUrl)

      if (!response.ok) {
        throw new Error('Failed to download video')
      }
      const blob = await response.blob()
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

      const blob = await response.blob()
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
    }
  }

  const handleAudioDownload = async () => {
    if (!state.audioUrl) return

    dispatch({ type: 'SET_DOWNLOADING_AUDIO', payload: true })

    try {
      const response = await fetch(state.audioUrl)

      if (!response.ok) {
        throw new Error('Failed to download audio')
      }
      const blob = await response.blob()
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
        const blob = await response.blob()
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

  return (
    <div ref={containerRef} className='mx-auto w-full max-w-2xl'>
      {/* Paste bar — the hero action. Input + CTA share one focus-ring pill. */}
      <div
        className={`flex flex-col gap-2 rounded-2xl border bg-white/[0.04] p-2 transition-colors duration-200 sm:flex-row ${
          urlError
            ? 'border-red-400/60'
            : 'border-white/[0.1] focus-within:border-cyan-400/60'
        }`}
      >
        <input
          type='text'
          placeholder='Paste a video link…'
          value={state.url}
          onChange={(e) => {
            if (urlError) setUrlError(null)
            dispatch({ type: 'SET_URL', payload: e.target.value })
          }}
          aria-invalid={urlError ? 'true' : 'false'}
          aria-describedby={urlError ? 'url-error' : undefined}
          className='min-w-0 flex-1 rounded-xl bg-transparent px-4 py-3 text-sm text-white placeholder-white/40 outline-none md:text-base'
        />
        <motion.button
          onClick={handleProcess}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.985 }}
          transition={{ type: 'spring', stiffness: 280, damping: 24, mass: 0.6 }}
          disabled={
            state.loading ||
            state.downloading ||
            state.downloadingAudio ||
            state.downloadingImages
          }
          className='btn-grad group relative flex shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl px-6 py-3 text-sm font-semibold transition-[box-shadow,transform] duration-300 ease-out disabled:cursor-not-allowed disabled:opacity-50 md:text-base'
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
        </motion.button>
      </div>

      <AnimatePresence initial={false}>
        {urlError && (
          <motion.p
            id='url-error'
            role='alert'
            initial={{ opacity: 0, y: -4, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -4, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className='mt-2 flex items-center gap-1.5 overflow-hidden text-xs text-red-300 md:text-sm'
          >
            <span aria-hidden>⚠</span>
            {urlError}
          </motion.p>
        )}
      </AnimatePresence>

      <p className='mt-3 text-center text-xs text-white/45'>
        Works with videos, reels, shorts &amp; photo carousels
      </p>

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

        {state.loading && !state.videoMetadata && <ResultsSkeleton />}

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
                      const platformConfig = {
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
                        unknown: {
                          label: 'View Original',
                          Icon: TikTokIcon,
                          color: 'text-pink-400 hover:text-pink-300',
                        },
                      }
                      const cfg =
                        platformConfig[platform ?? 'tiktok'] ??
                        platformConfig.tiktok
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
                <motion.button
                  onClick={togglePreview}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.985 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 24, mass: 0.6 }}
                  className='btn-ghost w-full cursor-pointer py-2.5 px-4 font-semibold rounded-xl transition-colors duration-200 flex items-center justify-center text-sm md:text-base'
                >
                  <span className='relative'>
                    {state.showPreview ? 'Hide preview' : 'Show preview'}
                  </span>
                </motion.button>
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
                    <motion.button
                      onClick={toggleImageGallery}
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.985 }}
                      transition={{ type: 'spring', stiffness: 280, damping: 24, mass: 0.6 }}
                      className='btn-ghost w-full cursor-pointer py-2.5 px-4 font-semibold rounded-xl transition-colors duration-200 flex items-center justify-center text-sm md:text-base'
                    >
                      <span className='relative'>
                        {state.showImageGallery
                          ? 'Hide images'
                          : `Show images (${state.videoMetadata.images.length})`}
                      </span>
                    </motion.button>

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
                      <motion.button
                        onClick={
                          state.downloadUrl
                            ? handleVideoDownload
                            : handleSlideshowRender
                        }
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.985 }}
                        transition={{ type: 'spring', stiffness: 280, damping: 24, mass: 0.6 }}
                        disabled={
                          state.downloading || state.downloadingImages
                        }
                        className='btn-grad group relative py-3 cursor-pointer px-4 disabled:opacity-50 disabled:cursor-not-allowed font-semibold rounded-xl transition-[box-shadow,transform] duration-300 ease-out flex items-center justify-center text-sm md:text-base gap-2 overflow-hidden'
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
                      </motion.button>
                    )}

                    {showAudioButton && (
                      <motion.button
                        onClick={handleAudioDownload}
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.985 }}
                        transition={{ type: 'spring', stiffness: 280, damping: 24, mass: 0.6 }}
                        disabled={
                          state.downloadingAudio || state.downloadingImages
                        }
                        className='btn-ghost py-3 cursor-pointer px-4 disabled:opacity-50 disabled:cursor-not-allowed font-semibold rounded-xl transition-colors duration-200 flex items-center justify-center text-sm md:text-base gap-2'
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
                      </motion.button>
                    )}
                  </div>
                )
              })()}

              {(state.downloadUrl || state.audioUrl) && (
                <p className='text-white/50 text-xs text-center'>
                  {state.downloading ||
                  state.downloadingAudio ||
                  state.downloadingImages
                    ? 'Please wait while we prepare your download...'
                    : 'Click to download your content'}
                </p>
              )}
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
