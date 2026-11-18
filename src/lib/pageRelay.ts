/**
 * Instagram's crawler view of a post, asked through a host Instagram still
 * answers.
 *
 * Production's Cloudflare egress gets `429, 0 chars` on the crawler view of a
 * reel, while a Deno-runtime relay outside Cloudflare gets `200` and the full
 * ~800 KB page for the same URL in the same minute (measured 2026-11-11). Only the HTML is refused; the media URLs inside it play from
 * anywhere, so only the page goes through the relay, never the bytes.
 *
 * The relay (`reely-resolver-relay`, `page.ts`, deployed alone as the
 * `reely-ig-page` Netlify site by `npm run deploy:page` there) fetches nothing but
 * `www.instagram.com/{p,reel,reels,tv}/<code>/`, and only for a request signed
 * with Ed25519 over `<url>|<exp>`. The private key is the `PAGE_RELAY_KEY`
 * Worker secret (base64url PKCS#8); the relay carries the public half. Unset,
 * the relay is simply not asked.
 *
 * Its own Netlify account (2026-11-18), so these pages never spend the film
 * relay's 300-credit pool; the old Deno Deploy home was suspended. Worker →
 * netlify.app is fine; only some ISPs block *.netlify.app for browsers.
 */
export const PAGE_RELAY = 'https://reely-ig-page.netlify.app/page'

/** How long a signed request stays good. The relay refuses more than 300 s. */
const VALID_FOR_S = 120

const fromB64url = (s: string): Uint8Array<ArrayBuffer> =>
  Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

const toB64url = (b: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(b)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

/** The signed relay URL for one page, or null when no usable key is set. */
export async function pageRelayUrl(
  pageUrl: string,
  privateKey: string | undefined,
  nowS = Math.floor(Date.now() / 1000),
): Promise<string | null> {
  const raw = privateKey?.trim()
  if (!raw) return null
  try {
    const key = await crypto.subtle.importKey(
      'pkcs8',
      fromB64url(raw),
      { name: 'Ed25519' },
      false,
      ['sign'],
    )
    const exp = nowS + VALID_FOR_S
    const sig = await crypto.subtle.sign(
      'Ed25519',
      key,
      new TextEncoder().encode(`${pageUrl}|${exp}`),
    )
    return `${PAGE_RELAY}?u=${encodeURIComponent(pageUrl)}&exp=${exp}&sig=${toB64url(sig)}`
  } catch (error) {
    console.warn('page relay: PAGE_RELAY_KEY is not a usable Ed25519 key', error)
    return null
  }
}
