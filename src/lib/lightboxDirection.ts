/**
 * The lightbox steps through slides in reading order. In Arabic that order runs
 * right to left, so "next" sits on the left: the arrow key, the swipe and the
 * slide animation all mirror. One rule, used by all three.
 */
export type Step = 1 | -1

/** Which step an arrow key means, or null for any other key. */
export function stepForKey(key: string, rtl: boolean): Step | null {
  let physical: Step | null = null
  if (key === 'ArrowRight') physical = 1
  else if (key === 'ArrowLeft') physical = -1
  if (physical === null) return null
  return rtl ? (-physical as Step) : physical
}

/**
 * Which step a finished swipe means. Dragging the slide toward the start of the
 * reading line (left in LTR, right in RTL) brings in the next one.
 */
export function stepForSwipe(
  offsetX: number,
  velocityX: number,
  rtl: boolean,
  offsetThreshold: number,
  velocityThreshold: number,
): Step | null {
  let physical: Step | null = null
  if (offsetX < -offsetThreshold || velocityX < -velocityThreshold) physical = 1
  else if (offsetX > offsetThreshold || velocityX > velocityThreshold) physical = -1
  if (physical === null) return null
  return rtl ? (-physical as Step) : physical
}

/** The screen-space sign the slide animation travels in for a logical step. */
export function slideSign(step: number, rtl: boolean): number {
  return rtl ? -step : step
}
