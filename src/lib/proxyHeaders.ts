// Shared by the /api/video, /api/audio and /api/image proxy routes.
//
// Some CDNs gate hotlinking by Referer. Returns the correct Referer for a
// given media URL, or '' when none is needed (e.g. Cobalt tunnel URLs and
// signed CDN URLs that ignore the header).

export function getMediaReferer(url: string): string {
  // YouTube / googlevideo (incl. Piped-proxied playback URLs)
  if (
    url.includes('googlevideo.com') ||
    url.includes('youtube.com') ||
    url.includes('ytimg.com')
  )
    return 'https://www.youtube.com/'

  if (
    url.includes('tiktok.com') ||
    url.includes('tiktokcdn.com') ||
    url.includes('tiktokv.com')
  )
    return 'https://www.tiktok.com/'

  if (url.includes('tikwm.com')) return 'https://www.tikwm.com/'

  if (
    url.includes('twimg.com') ||
    url.includes('twitter.com') ||
    url.includes('x.com')
  )
    return 'https://x.com/'

  // Facebook video CDN (video-*.fbcdn.net) and facebook.com hosts. Checked
  // before the shared fbcdn/Instagram branch so FB clips get the FB referer.
  if (
    url.includes('facebook.com') ||
    url.includes('fb.watch') ||
    (url.includes('fbcdn') && url.includes('video'))
  )
    return 'https://www.facebook.com/'

  // Instagram media (also lives on fbcdn.net / cdninstagram.com)
  if (
    url.includes('cdninstagram.com') ||
    url.includes('fbcdn.net') ||
    url.includes('instagram.com')
  )
    return 'https://www.instagram.com/'

  // Cobalt tunnel URLs and anything else — no referer needed
  return ''
}

/**
 * Normalize an upstream range response into a spec-compliant one.
 *
 * Some upstreams — notably Cobalt tunnels — answer a Range request with a
 * `206 Partial Content` but OMIT the mandatory `Content-Range` header. `curl`
 * tolerates that, but browsers reject such a response for `<video>`/`<audio>`
 * playback, so the in-page preview fails (`onError`) even though a plain
 * download — which sends no Range and gets a clean `200` — still works.
 *
 * This restores a valid response:
 *   - open-ended range (`bytes=N-`): the upstream body is `[N .. EOF]`, so the
 *     total size is `N + bodyLength` and we can synthesize the Content-Range.
 *     This is the shape every browser's media element uses (including for
 *     seeking), so it's both correct and efficient.
 *   - any other shape with an unknown total: re-fetch the whole resource and
 *     serve it as a plain `200` instead of a broken `206`.
 *
 * Responses that already carry a `Content-Range` (real CDNs, tikwm) — or that
 * weren't range requests at all — pass through untouched.
 */
export async function resolveRangeResponse(
  response: Response,
  rangeHeader: string | null,
  refetchFull: () => Promise<Response>,
): Promise<{
  status: number
  body: ReadableStream<Uint8Array> | null
  contentLength: string | null
  contentRange: string | null
}> {
  const contentRange = response.headers.get('content-range')
  const contentLength = response.headers.get('content-length')

  if (!rangeHeader || contentRange || response.status !== 206) {
    return {
      status: response.status,
      body: response.body,
      contentLength,
      contentRange,
    }
  }

  const match = /bytes=(\d+)-(\d*)/.exec(rangeHeader)
  const len = contentLength ? parseInt(contentLength, 10) : NaN
  if (match && match[2] === '' && Number.isFinite(len)) {
    const start = parseInt(match[1], 10)
    const total = start + len
    return {
      status: 206,
      body: response.body,
      contentLength: String(len),
      contentRange: `bytes ${start}-${total - 1}/${total}`,
    }
  }

  // Closed range with an unknown total — can't safely synthesize. Drop this
  // partial body and serve the whole resource as a plain 200.
  response.body?.cancel().catch(() => {})
  const full = await refetchFull()
  return {
    status: 200,
    body: full.body,
    contentLength: full.headers.get('content-length'),
    contentRange: null,
  }
}
