/** Marks the lightbox areas that are not backdrop: the top bar, the media, the bottom bar. */
export const LIGHTBOX_KEEP = 'data-lightbox-keep'

/**
 * Whether a click on the lightbox closes it. Only a click on the backdrop does: not one inside a
 * marked area, and not the click a drag's pointerup synthesizes. The marked areas replaced
 * `onClick={stopPropagation}` wrappers (2026-11-22), so no static element carries a click handler.
 */
export function closesLightbox(
  target: { closest(selector: string): unknown } | null,
  dragging: boolean
): boolean {
  if (dragging) return false
  return !target?.closest(`[${LIGHTBOX_KEEP}]`)
}
