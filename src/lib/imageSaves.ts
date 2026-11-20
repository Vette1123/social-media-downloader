/**
 * Pacing for saving a gallery one file at a time.
 *
 * Browsers drop or block downloads fired back to back, so saves are spaced
 * out. The gap only belongs BETWEEN files: waiting after the last one held
 * the button busy and "Saved" back for half a second on every single-image
 * save, which is where visitors pressed again.
 */
export const IMAGE_SAVE_GAP_MS = 500

export function imageSaveStep(
  index: number,
  total: number,
): { pct: number; pauseMs: number } {
  const last = index >= total - 1
  return {
    pct: Math.round(((index + 1) / total) * 100),
    pauseMs: last ? 0 : IMAGE_SAVE_GAP_MS,
  }
}

/** How a gallery save went, counted off the files actually written, never the
 * selection size: expired links write nothing, and saying "5 saved" then is a lie. */
export function gallerySaveOutcome(saved: number, total: number): 'all' | 'some' | 'none' {
  if (saved <= 0) return 'none'
  return saved >= total ? 'all' : 'some'
}

/**
 * A fetch that never reached the server: Chrome/Firefox "Failed to fetch",
 * Safari "Load failed", Firefox "NetworkError…". The connection is gone, so
 * every later file in the same run fails the same way within milliseconds —
 * 23 `download:image_item` events from 5 people in Nov 2026 were bursts of 5,
 * 2 ms apart. Stop the run on the first one and report it once.
 */
export function isConnectionDrop(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    /^(Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.?)$/i.test(error.message)
  )
}
