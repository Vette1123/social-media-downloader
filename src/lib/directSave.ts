/**
 * The direct-save decision, on its own so both consumers can import it without
 * the apiRoutes import graph (which must never grow a cycle — see the header
 * of src/lib/apiRoutes.ts; the Telegram webhook imports Downloader and this,
 * but not the route table).
 *
 * A Cobalt tunnel streams with `Content-Disposition: attachment` from any
 * address. A recipe-built URL (see `directBrowser` in types.ts) comes from a
 * host that may wall our own egress: a navigation with the referrer stripped
 * gets the full file as an attachment there, where the proxy would only reach
 * the wall. Anything else has no direct form and stays on the proxy.
 */

import type { VideoData } from './types'

/**
 * An http tunnel URL cannot be handed a browser to save: it would report an
 * http self-URL, and an https page navigating to that is a mixed-content
 * navigation which displays the file instead of downloading it.
 */
export function asDirectTunnel(url: string | undefined): string | undefined {
  if (!url || url.startsWith('/')) return undefined
  return url.replace(/^http:\/\//i, 'https://')
}

export function directSaveUrl(
  videoData: Pick<VideoData, 'tunnel' | 'directBrowser' | 'downloadUrl'>,
): string | undefined {
  if (videoData.tunnel) return asDirectTunnel(videoData.downloadUrl)
  if (videoData.directBrowser) return videoData.downloadUrl
  return undefined
}

/**
 * CDN hosts measured on 2026-11-19 to answer a cross-origin ranged GET from our
 * page with `Access-Control-Allow-Origin` and the full file, with no referer,
 * from an address other than the one that resolved the link. The page can
 * fetch these itself with a progress bar: about as fast as our proxy or faster
 * (fbcdn 3.1 vs 2.0 MB/s, Instagram 1.9 vs 1.2 MB/s), and the bytes never cross
 * the Worker. A failed read still falls back to the proxy in the client.
 * ponytail: a hand-kept list; a host that drops CORS only costs one failed
 * fetch before the proxy retry. Add a host only after measuring its headers.
 */
const CORS_CDN_HOSTS = [
  /\.fbcdn\.net$/,
  /\.cdninstagram\.com$/,
  /^video\.twimg\.com$/,
  // tikwm's TikTok URLs (v16-notes, v19): `*` CORS and full reads, 2026-11-19.
  /\.tiktokcdn-us\.com$/,
]

function isCorsCdn(url: string | undefined): boolean {
  if (!url) return false
  try {
    const { protocol, hostname } = new URL(url)
    return protocol === 'https:' && CORS_CDN_HOSTS.some((host) => host.test(hostname))
  } catch {
    return false
  }
}

/**
 * The URL the web page should read the video from before trying our proxy: an
 * attachment URL when there is one, else a CDN URL the page is allowed to
 * fetch cross-origin. Only the first kind may be handed to a navigation —
 * that is what `isAttachment` says; a raw CDN file navigated to plays inline
 * instead of saving.
 */
export function directFetch(
  videoData: Pick<VideoData, 'tunnel' | 'directBrowser' | 'downloadUrl'>,
): { url?: string; isAttachment: boolean } {
  const attachment = directSaveUrl(videoData)
  if (attachment) return { url: attachment, isAttachment: true }
  if (isCorsCdn(videoData.downloadUrl)) return { url: videoData.downloadUrl, isAttachment: false }
  return { isAttachment: false }
}
