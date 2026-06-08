export type SupportedPlatform =
  | 'tiktok'
  | 'twitter'
  | 'instagram'
  | 'facebook'
  | 'youtube'
  | 'unknown'

const platformPatterns: Record<
  Exclude<SupportedPlatform, 'unknown'>,
  RegExp[]
> = {
  tiktok: [
    /^(https?:\/\/)?(www\.)?tiktok\.com\/@[\w.-]+\/video\/\d+/,
    /^(https?:\/\/)?(www\.)?tiktok\.com\/[\w.-]+\/video\/\d+/,
    /^(https?:\/\/)?vm\.tiktok\.com\/[\w\d]+/,
    /^(https?:\/\/)?vt\.tiktok\.com\/[\w\d]+/,
    /^(https?:\/\/)?m\.tiktok\.com\/v\/\d+/,
    /^(https?:\/\/)?(www\.)?tiktok\.com\/t\/[\w\d]+/,
  ],
  twitter: [
    /^(https?:\/\/)?(www\.)?(twitter|x)\.com\/[\w]+\/status\/\d+/,
    /^(https?:\/\/)?t\.co\/[\w\d]+/,
  ],
  instagram: [
    // Post / reel / IGTV, with or without a leading /<username>/ segment
    /^(https?:\/\/)?(www\.)?instagram\.com\/(?:[\w.-]+\/)?(?:p|reel|reels|tv)\/[\w-]+/,
    // instagr.am short domain
    /^(https?:\/\/)?(www\.)?instagr\.am\/(?:p|reel|reels|tv)\/[\w-]+/,
    // New-style share links (resolved to a canonical post URL before extraction)
    /^(https?:\/\/)?(www\.)?instagram\.com\/share\/[\w-]+/,
  ],
  youtube: [
    // Standard watch URL (?v=…) — also covers music.youtube.com and m.youtube.com
    /^(https?:\/\/)?(www\.|m\.|music\.)?youtube\.com\/watch\?[^ ]*v=[\w-]{11}/,
    // youtu.be short links
    /^(https?:\/\/)?youtu\.be\/[\w-]{11}/,
    // Shorts, embeds, and live URLs
    /^(https?:\/\/)?(www\.|m\.)?youtube\.com\/(?:shorts|embed|live|v)\/[\w-]{11}/,
    // youtube-nocookie embeds
    /^(https?:\/\/)?(www\.)?youtube-nocookie\.com\/embed\/[\w-]{11}/,
  ],
  facebook: [
    // Short watch links
    /^(https?:\/\/)?(www\.)?fb\.watch\/[\w-]+/,
    // /watch/?v=… and ?v=… variants
    /^(https?:\/\/)?(www\.|web\.|m\.)?facebook\.com\/watch\/?\?[^ ]*v=\d+/,
    // /<page>/videos/<id> and /<page>/videos/<slug>/<id>
    /^(https?:\/\/)?(www\.|web\.|m\.)?facebook\.com\/[\w.-]+\/videos\/(?:[\w.-]+\/)?\d+/,
    // Reels
    /^(https?:\/\/)?(www\.|web\.|m\.)?facebook\.com\/reel\/\d+/,
    // Share links (resolved to canonical before extraction): /share/v/…, /share/r/…
    /^(https?:\/\/)?(www\.|web\.|m\.)?facebook\.com\/share\/[vr]\/[\w-]+/,
    // Story / permalink video and bare ?v= on the root domain
    /^(https?:\/\/)?(www\.|web\.|m\.)?facebook\.com\/(?:[\w.-]+\/)?(?:video\.php|story\.php|permalink\.php)\?[^ ]*v?=?\d+/,
  ],
}

export function detectPlatform(url: string): SupportedPlatform {
  if (!url || typeof url !== 'string') return 'unknown'
  const trimmed = url.trim()
  for (const [platform, patterns] of Object.entries(platformPatterns)) {
    if (patterns.some((p) => p.test(trimmed))) {
      return platform as SupportedPlatform
    }
  }
  return 'unknown'
}

export function validateUrl(url: string): boolean {
  return detectPlatform(url) !== 'unknown'
}

export function parseVideoId(url: string): string | null {
  const patterns = [
    /\/video\/(\d+)/,
    /\/v\/(\d+)/,
    /vm\.tiktok\.com\/([\w\d]+)/,
    /vt\.tiktok\.com\/([\w\d]+)/,
    /\/t\/([\w\d]+)/,
    /\/status\/(\d+)/,
    /\/p\/([\w-]+)/,
    /\/reel\/([\w-]+)/,
    /\/videos\/(\d+)/,
    /v=(\d+)/,
    /fb\.watch\/([\w\d-]+)/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  return null
}

/**
 * Extracts the Instagram shortcode (the alphanumeric id in /p/<code>,
 * /reel/<code>, /reels/<code>, /tv/<code>) from a post URL. Tolerates an
 * optional leading /<username>/ segment and trailing query/hash.
 */
export function parseInstagramShortcode(url: string): string | null {
  const patterns = [
    /instagram\.com\/(?:[\w.-]+\/)?(?:p|reel|reels|tv)\/([\w-]+)/,
    /instagr\.am\/(?:p|reel|reels|tv)\/([\w-]+)/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) return match[1]
  }
  return null
}

/**
 * Extracts the 11-character YouTube video id from any common URL shape:
 * watch?v=…, youtu.be/…, /shorts/…, /embed/…, /live/…, /v/….
 */
export function parseYouTubeId(url: string): string | null {
  const patterns = [
    /youtu\.be\/([\w-]{11})/,
    /[?&]v=([\w-]{11})/,
    /\/shorts\/([\w-]{11})/,
    /\/embed\/([\w-]{11})/,
    /\/live\/([\w-]{11})/,
    /\/v\/([\w-]{11})/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match && match[1]) return match[1]
  }
  return null
}
