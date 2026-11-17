/**
 * The box the inline preview <video> is drawn in, decided before the video
 * exists.
 *
 * A `h-auto` video starts at 300x150, grows to its poster's shape when the
 * poster lands, and again to the stream's shape after play, each a layout shift
 * seconds after the tap, so every one is scored. Field CLS p75 was 0.263 for
 * mobile sessions that resolved a link (17 Nov). The result thumbnail has
 * already loaded by the time anyone presses "Show preview", and it is the same
 * picture as the poster, so its shape is the video's shape.
 *
 * Clamped to 9:16 ... 16:9 so a strip-shaped thumbnail cannot make a sliver or
 * a tower; the video letterboxes inside with object-contain.
 */
const PORTRAIT = 9 / 16
const LANDSCAPE = 16 / 9

export function previewAspectRatio(width?: number, height?: number): string {
  if (!width || !height || width <= 0 || height <= 0) return '16 / 9'
  const ratio = Math.min(LANDSCAPE, Math.max(PORTRAIT, width / height))
  return `${Math.round(ratio * 1000) / 1000} / 1`
}
