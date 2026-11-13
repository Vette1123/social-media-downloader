import { HINT_COOKIE } from './auth/cookies'

/**
 * Whether this browser belongs to a supporter, known before first paint.
 *
 * Pages are static, so the HTML is always the free page, and the server's
 * answer (`/api/auth/refresh`) lands a round trip after the page is already on
 * screen. Every free-only element (the "free, no limits" line above the paste
 * bar, the support panel, nudges, the promo slot's reserved box) used to be
 * painted and then pulled out from under a supporter, moving the paste bar and
 * the Download button on every refresh.
 *
 * The head script below reads the same two things the account store trusts for
 * display — the session hint cookie and the cached profile — and marks <html>
 * before paint. CSS hides `[data-free-only]` under that mark, so for a
 * supporter those elements are never painted at all. The store re-syncs the
 * mark whenever the server answers, so a lapsed plan shows the free page again.
 *
 * Display only: nothing that costs us anything trusts it. Server work is gated
 * by the signed token, as before.
 */
export const PRO_ATTR = 'data-pro'
export const PROFILE_CACHE_KEY = 'smd_profile'

/** One source for the head script and its test: a function expression, as text. */
export const proBootSource = `function(d,s){try{
var hint=d.cookie.split(';').some(function(p){return p.trim().indexOf('${HINT_COOKIE}=1')===0});
var cached=hint&&JSON.parse(s.getItem('${PROFILE_CACHE_KEY}')||'null');
if(cached&&cached.pro===true)d.documentElement.setAttribute('${PRO_ATTR}','');
}catch(e){}}`

export const proFlagScript = `(${proBootSource})(document,window.localStorage);`

/** Called with every answer the server gives, so the mark never outlives the plan. */
export function syncProFlag(pro: boolean): void {
  if (typeof document === 'undefined') return
  document.documentElement?.toggleAttribute(PRO_ATTR, pro)
}

/**
 * The tier to render. The server's answer once there is one; until then the
 * boot mark, so a supporter's page is already their page at hydration.
 */
export function tierFrom(
  account: { signedIn: boolean | undefined; pro: boolean },
  bootPro: boolean,
): 'free' | 'pro' {
  const pro = account.signedIn === undefined ? bootPro : account.pro
  return pro ? 'pro' : 'free'
}
