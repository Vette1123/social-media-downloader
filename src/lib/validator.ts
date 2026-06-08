export type SupportedPlatform = 'tiktok' | 'twitter' | 'instagram' | 'unknown'

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
