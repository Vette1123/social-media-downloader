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
