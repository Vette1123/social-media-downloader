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
