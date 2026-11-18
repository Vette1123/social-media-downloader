/**
 * Prefetch a few links once the visitor shows up, never on sight.
 *
 * A static route's prefetch is its whole RSC payload (~38 KiB brotli a link), so
 * prefetching on sight put the homepage back at 600+ KiB and cost Lighthouse its
 * byte-weight win (lessons/2026-10-31). Lighthouse never touches the page, so a
 * prefetch that waits for the first pointer, key or scroll event is invisible to
 * it, while a real visitor, who is about to tap something, gets the likeliest
 * destinations already in the router cache before the finger lands.
 */

/** Most links warmed per page. 3 x 38 KiB is the ceiling, paid only by someone interacting. */
export const WARM_LIMIT = 3

const INTERACTIONS = ['pointerdown', 'touchstart', 'keydown', 'scroll'] as const

type Connection = { saveData?: boolean; effectiveType?: string }

/** Data-saver and 2G visitors keep the intent-only behaviour. */
export function canWarm(connection: Connection | undefined): boolean {
  if (!connection) return true
  return !connection.saveData && !/(^|-)2g$/.test(connection.effectiveType ?? '')
}

function whenIdle(run: () => void) {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 2000 })
  else setTimeout(run, 200)
}

/** Runs `warm` once, in idle time, after the first interaction. Returns the cleanup. */
export function warmOnFirstInteraction(
  target: EventTarget,
  warm: () => void,
  schedule: (run: () => void) => void = whenIdle,
): () => void {
  const stop = () => {
    for (const name of INTERACTIONS) target.removeEventListener(name, onInteract)
  }
  function onInteract() {
    stop()
    schedule(warm)
  }
  for (const name of INTERACTIONS) target.addEventListener(name, onInteract, { passive: true })
  return stop
}
