/**
 * Recent's box, reserved before first paint for a returning visitor.
 *
 * Pages are static and the Recent list lives in localStorage, so the HTML never
 * has it: the list arrived at hydration and pushed everything under the paste
 * bar down, on every refresh. Its rows cannot be painted before React owns
 * them, but their height can. The client stores the height the list last
 * rendered at; the head script below reads it before paint and reveals an
 * empty slot of exactly that height (CSS: `[data-recent-slot]`), which the real
 * list replaces in the same render as hydration.
 *
 * ponytail: one measurement per browser, valid only at the width it was taken
 * at. A rotated phone or resized window gets no reserve (the old behaviour)
 * until the list renders once at the new width.
 */
export const RECENT_HEIGHT_KEY = 'smd:recent:h'
export const RECENT_ATTR = 'data-recent'
/** Taller than the collapsed list can be; anything above it is a bad read. */
const MAX_HEIGHT = 2000

/** "width:height", so a reserve never applies at a width that wraps differently. */
export function encodeRecentHeight(width: number, height: number): string {
  return `${Math.round(width)}:${Math.round(height)}`
}

/** One source for the head script and its test: a function expression, as text. */
export const recentBootSource = `function(w){try{
var v=(w.localStorage.getItem('${RECENT_HEIGHT_KEY}')||'').split(':');
var wd=+v[0],h=+v[1];
if(h>0&&h<${MAX_HEIGHT}&&Math.abs(wd-w.innerWidth)<2){
var e=w.document.documentElement;
e.style.setProperty('--recent-h',h+'px');
e.setAttribute('${RECENT_ATTR}','');
}}catch(e){}}`

export const recentReserveScript = `(${recentBootSource})(window);`

export function rememberRecentHeight(width: number, height: number): void {
  try {
    window.localStorage.setItem(RECENT_HEIGHT_KEY, encodeRecentHeight(width, height))
  } catch {
    // Storage denied: no reserve next time, the old behaviour.
  }
}

/** An empty list must not leave a blank box behind on the next visit. */
export function forgetRecentHeight(): void {
  try {
    window.localStorage.removeItem(RECENT_HEIGHT_KEY)
  } catch {
    // Nothing was stored either.
  }
}
