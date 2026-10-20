import { describe, expect, it } from 'vitest'
import {
  appReducer,
  autoOpensPreview,
  initialState,
  isResolvingOrDownloading,
  retryTarget,
  type ImageData,
} from './appReducer'

const base = {
  platform: 'tiktok' as const,
  hasVideo: true,
  hasEmbed: false,
  isCarousel: false,
}

describe('autoOpensPreview', () => {
  it('opens for a known platform with a downloadable video', () => {
    expect(autoOpensPreview(base)).toBe(true)
  })

  it('opens for a generic link the server verified as media', () => {
    // The server only returns a generic downloadUrl after confirming it serves
    // a file and not a web page, so by this point "is it really video" is
    // answered — staying shut would cost every long-tail site a click.
    expect(autoOpensPreview({ ...base, platform: 'generic' })).toBe(true)
  })

  it('stays shut when the platform is missing', () => {
    expect(autoOpensPreview({ ...base, platform: undefined })).toBe(false)
  })

  it('stays shut for an embed, which would load the third-party player', () => {
    expect(
      autoOpensPreview({ ...base, platform: 'youtube', hasEmbed: true }),
    ).toBe(false)
  })

  it('stays shut for a carousel, which has no video to preview', () => {
    expect(autoOpensPreview({ ...base, isCarousel: true })).toBe(false)
  })

  it('stays shut when there is nothing to play', () => {
    expect(autoOpensPreview({ ...base, hasVideo: false })).toBe(false)
  })

  it('keeps unknown payload shapes shut even when every other signal says open', () => {
    // Guards the ordering: `undefined` (an older/foreign result shape) must
    // not be rescued by hasVideo.
    expect(
      autoOpensPreview({
        platform: undefined,
        hasVideo: true,
        hasEmbed: false,
        isCarousel: false,
      }),
    ).toBe(false)
  })
})

/**
 * The status banner used to infer green/red/neutral from emoji markers inside
 * the message text — a parse of our own copy, re-implemented per reader. The
 * kind now travels with the message, so these pin what the reducer guarantees:
 * kind survives a dispatch verbatim, and the reducer's own success is flagged
 * as resolve-done (`success`), never as file-on-disk (`saved`) — the Recent
 * stamp must not fire for a link that was merely pasted.
 */
describe('the typed message channel', () => {
  it('stores kind and text verbatim', () => {
    const state = appReducer(initialState, {
      type: 'SET_MESSAGE',
      payload: { kind: 'info', text: 'Preparing your download…' },
    })
    expect(state.message).toEqual({
      kind: 'info',
      text: 'Preparing your download…',
    })
  })

  it('clears to null on reset', () => {
    const messaged = appReducer(initialState, {
      type: 'SET_MESSAGE',
      payload: { kind: 'error', text: 'nope' },
    })
    expect(
      appReducer(messaged, { type: 'RESET_DOWNLOAD_STATE' }).message,
    ).toBeNull()
  })

  it('a finished resolve is a success, not a save', () => {
    const state = appReducer(initialState, {
      type: 'SET_DOWNLOAD_SUCCESS',
      payload: {
        originalUrl: 'https://www.tiktok.com/@a/video/1',
        metadata: {
          title: 't',
          author: 'a',
          duration: 0,
          thumbnail: '',
          platform: 'tiktok',
        },
      },
    })
    expect(state.message?.kind).toBe('success')
    // The text is mapped per-locale at render (displayMessage), so the
    // reducer always sets the English constant.
    expect(state.message?.text).toBe('Content processed successfully!')
  })
})

/**
 * The banner's second gate. An `error` message alone cannot distinguish a
 * settled failure from a running commentary — the in-flight kinds arrive as
 * `info` — so the retry offer also asks whether anything is still in flight.
 * Without this, every transfer in progress renders a button offering to
 * restart itself.
 */
describe('isResolvingOrDownloading', () => {
  const idle = {
    loading: false,
    downloading: false,
    downloadingAudio: false,
    downloadingImages: false,
  }

  it('is false only when nothing at all is running', () => {
    expect(isResolvingOrDownloading(idle)).toBe(false)
  })

  it.each([
    'loading',
    'downloading',
    'downloadingAudio',
    'downloadingImages',
  ] as const)('is true while %s is set', (flag) => {
    expect(isResolvingOrDownloading({ ...idle, [flag]: true })).toBe(true)
  })

  it('suppresses the retry offer under an in-flight info status', () => {
    // Exactly the banner's condition: kind error on screen, but something
    // still running underneath (a proxied transfer after a stall).
    const state = { ...idle, downloading: true }
    const showRetry = (msg: { kind: string } | null) =>
      msg?.kind === 'error' && !isResolvingOrDownloading(state)
    expect(showRetry({ kind: 'error' })).toBe(false)
  })

  it('offers the retry once a failure has settled', () => {
    const showRetry = (msg: { kind: string } | null) =>
      msg?.kind === 'error' && !isResolvingOrDownloading(idle)
    expect(showRetry({ kind: 'error' })).toBe(true)
    expect(showRetry({ kind: 'info' })).toBe(false)
    expect(showRetry({ kind: 'saved' })).toBe(false)
  })
})

/**
 * The gallery opens by itself for a post that has one, and it used to open with
 * nothing ticked — so its own action read "Download selected (0)", disabled,
 * and the panel did nothing until the visitor found the "All" button.
 */
describe('a resolved carousel', () => {
  const resolved = (images: ImageData[]) =>
    appReducer(initialState, {
      type: 'SET_DOWNLOAD_SUCCESS',
      payload: {
        downloadUrl: '',
        audioUrl: '',
        originalUrl: 'https://www.instagram.com/p/x/',
        metadata: {
          title: 't',
          author: 'a',
          duration: 0,
          thumbnail: '',
          images,
        },
      },
    })

  it('arrives with every slide selected', () => {
    const state = resolved([
      { id: '1', url: 'a.jpg', thumbnail: 'a.jpg', selected: false },
      { id: '2', url: 'b.mp4', thumbnail: 'b.jpg', selected: false, kind: 'video' },
    ])
    expect(state.videoMetadata?.images?.every((i) => i.selected)).toBe(true)
    expect(state.showImageGallery).toBe(true)
  })

  it('carries the kind through so the gallery knows what each slide is', () => {
    const state = resolved([
      { id: '1', url: 'a.jpg', thumbnail: 'a.jpg', selected: false },
      { id: '2', url: 'b.mp4', thumbnail: 'b.jpg', selected: false, kind: 'video' },
    ])
    expect(state.videoMetadata?.images?.map((i) => i.kind)).toEqual([
      undefined,
      'video',
    ])
  })

  it('leaves a plain video result alone', () => {
    const state = resolved([])
    expect(state.showImageGallery).toBe(false)
  })
})

describe('what a retry re-runs', () => {
  /**
   * The bug this exists for. `RESET_DOWNLOAD_STATE` clears `originalUrl` at the
   * start of every attempt, so a resolve that failed leaves it empty — and the
   * banner's retry button, whose entire reason for existing is a failed
   * resolve, was gated on it and therefore never rendered.
   */
  it('falls back to the attempted link when the resolve failed', () => {
    expect(retryTarget({ originalUrl: '', url: 'https://x.com/i/status/1' }))
      .toBe('https://x.com/i/status/1')
  })

  /**
   * After a *download* failure there is a result on screen, and re-resolving
   * its link is what gets fresh URLs for an expired tunnel — so the result's
   * own link wins over whatever is left in the field.
   */
  it('prefers the resolved link when there is one', () => {
    expect(retryTarget({ originalUrl: 'https://a.test/p/1', url: 'typing…' }))
      .toBe('https://a.test/p/1')
  })

  it('offers nothing to retry when there is nothing', () => {
    expect(retryTarget({ originalUrl: '', url: '' })).toBe('')
    expect(retryTarget({ originalUrl: '', url: '   ' })).toBe('')
  })
})
