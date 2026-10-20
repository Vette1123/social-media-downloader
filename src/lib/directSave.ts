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
