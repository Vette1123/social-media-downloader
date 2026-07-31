/**
 * The single client-side entry to POST /api/download.
 *
 * Lifted verbatim out of `DownloaderApp`'s `resolveOne` so the Pro batch queue
 * can run the same pipeline without importing a React component. Nothing here
 * touches hooks, component state, or the DOM — the caller passes everything in.
 *
 * Sibling modules are imported by relative path (not `@/lib/...`) so this file
 * loads in the Vitest node environment, which has no path-alias plugin.
 */

import type { VideoMetadata } from './appReducer'
import { resolveTikTokInBrowser } from './tikwmClient'
import { detectPlatform } from './validator'

export interface ResolveOptions {
  type?: 'video' | 'audio'
  quality?: 'hd' | 'sd'
  /**
   * `'video'` and `'auto'` are the same thing to the server: `handleDownload`
   * maps anything that is not `'audio'` to mode `'auto'`. Both are accepted so
   * the paste box can keep sending the exact value it always sent while the
   * batch queue uses the plan's `'auto'`.
   */
  format?: 'auto' | 'video' | 'audio'
  /** Task 15: sent as X-Pro-Token so the Worker can prefer the fast resolver. */
  proToken?: string | null
  signal?: AbortSignal
}

export interface ResolveResult {
  success: boolean
  downloadUrl?: string
  audioUrl?: string
  metadata?: VideoMetadata
  error?: string
}

/**
 * Resolve one link against the API. Returns the parsed response, or throws on
 * network failure — the caller owns the error copy.
 */
export async function resolve(
  url: string,
  opts: ResolveOptions = {},
): Promise<ResolveResult> {
  const wantType = opts.type ?? 'video'
  const wantQuality = opts.quality ?? 'hd'
  const wantFormat = opts.format ?? 'auto'

  // TikTok resolves ~25x faster straight from the browser, and costs us
  // nothing at all when it works — see lib/tikwmClient. It returns null on
  // any hiccup, which lands us on the server path below unchanged.
  if (wantFormat !== 'audio' && detectPlatform(url) === 'tiktok') {
    const local = await resolveTikTokInBrowser(url, wantQuality)
    if (local) return local
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (opts.proToken) headers['X-Pro-Token'] = opts.proToken

  const response = await fetch('/api/download', {
    method: 'POST',
    headers,
    signal: opts.signal,
    body: JSON.stringify({
      url,
      type: wantType,
      quality: wantQuality,
      format: wantFormat,
    }),
  })
  return response.json()
}
