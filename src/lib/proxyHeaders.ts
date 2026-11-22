// Shared by the /api/video, /api/audio and /api/image proxy routes.
//
// Some CDNs gate hotlinking by Referer. Returns the correct Referer for a
// given media URL, or '' when none is needed (e.g. Cobalt tunnel URLs and
// signed CDN URLs that ignore the header).

// Host-boundary match: a bare substring check for a short suffix would also
// hit longer unrelated hosts that merely end in those characters.
function isHost(url: string, domain: string): boolean {
  try {
    const host = new URL(url).hostname
    return host === domain || host.endsWith('.' + domain)
  } catch {
    return false
  }
}

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
    isHost(url, 'x.com')
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

  // LinkedIn media lives on media.licdn.com and akm.linkedin.com
  if (url.includes('licdn.com') || url.includes('linkedin.com'))
    return 'https://www.linkedin.com/'

  // Cobalt tunnel URLs and anything else — no referer needed here. A generic
  // site's media gets its page's origin instead; see pageOriginReferer.
  return ''
}

/**
 * The origin of the page a link was resolved from, as a Referer value, or ''
 * for anything that is not an http(s) URL.
 *
 * Many sites serve media from a CDN on another registrable domain and refuse
 * it (403) without a Referer naming the page's own site. A browser playing the
 * page sends exactly this, so it is the one value that works for every such
 * site without keeping a per-site list. Only the origin is returned: the full
 * page path is never needed and would leak more than a browser sends
 * cross-origin under its default referrer policy.
 */
export function pageOriginReferer(pageUrl: string | null | undefined): string {
  if (!pageUrl) return ''
  try {
    const parsed = new URL(pageUrl)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return ''
    return `${parsed.origin}/`
  } catch {
    return ''
  }
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
  refetchFrom: (rangeHeader: string) => Promise<Response>,
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
    return openEndedFrom(parseInt(match[1], 10), len, response.body)
  }

  // A CLOSED range (`bytes=A-B`) with an unknown total — a seek. We can't
  // synthesize a Content-Range from this response, but the open-ended form of
  // the same request does carry enough to: ask for `bytes=A-` instead and the
  // body is `[A .. EOF]`, so the total falls out as `A + length`.
  //
  // This used to re-fetch the resource from byte 0 and serve a plain 200, which
  // both re-downloaded everything before the seek point and dropped the client
  // back to the start of playback. Re-asking from A costs one request and
  // answers the seek properly.
  if (!match) return passthrough(response)

  response.body?.cancel().catch(() => {})
  const start = parseInt(match[1], 10)
  const reopened = await refetchFrom(`bytes=${start}-`)
  const reopenedLength = reopened.headers.get('content-length')
  const reopenedRange = reopened.headers.get('content-range')
  // A cooperative upstream may answer the retry with a proper Content-Range, in
  // which case there is nothing left to synthesize.
  if (reopenedRange) {
    return {
      status: reopened.status,
      body: reopened.body,
      contentLength: reopenedLength,
      contentRange: reopenedRange,
    }
  }
  const reopenedLen = reopenedLength ? parseInt(reopenedLength, 10) : NaN
  if (Number.isFinite(reopenedLen)) {
    return openEndedFrom(start, reopenedLen, reopened.body)
  }
  // Still no size to work with. Serve what we got rather than failing the seek.
  return passthrough(reopened)
}

/** A spec-compliant 206 for a body known to be `[start .. EOF]` of `len` bytes. */
function openEndedFrom(
  start: number,
  len: number,
  body: ReadableStream<Uint8Array> | null,
) {
  const total = start + len
  return {
    status: 206,
    body,
    contentLength: String(len),
    contentRange: `bytes ${start}-${total - 1}/${total}`,
  }
}

function passthrough(response: Response) {
  return {
    status: response.status,
    body: response.body,
    contentLength: response.headers.get('content-length'),
    contentRange: response.headers.get('content-range'),
  }
}
