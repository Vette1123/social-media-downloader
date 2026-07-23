export type SupportedPlatform =
  | 'tiktok'
  | 'twitter'
  | 'instagram'
  | 'facebook'
  | 'youtube'
  | 'pinterest'
  | 'reddit'
  | 'threads'
  | 'snapchat'
  | 'twitch'
  | 'vimeo'
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
    // Story items and highlights (resolved via a logged-in session — see
    // Downloader.downloadInstagramStory).
    /^(https?:\/\/)?(www\.)?instagram\.com\/stories\/highlights\/\d+/,
    /^(https?:\/\/)?(www\.)?instagram\.com\/stories\/[\w.-]+\/\d+/,
    // New-style share links (resolved to a canonical URL before extraction)
    /^(https?:\/\/)?(www\.)?instagram\.com\/share\/[\w-]+/,
    /^(https?:\/\/)?(www\.)?instagram\.com\/s\/[\w-]+/,
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
  // The platforms below are resolved through the generic Cobalt/yt-dlp path
  // (see Downloader.downloadGeneric) — no bespoke extractor, so the patterns
  // only need to recognise a shareable post/clip URL.
  pinterest: [
    /^(https?:\/\/)?(www\.)?pinterest\.[a-z.]+\/pin\/\d+/,
    /^(https?:\/\/)?pin\.it\/[\w]+/,
  ],
  reddit: [
    /^(https?:\/\/)?(www\.|old\.|new\.|m\.)?reddit\.com\/(?:r|user|u)\/[\w.-]+\/comments\/[\w]+/,
    // New-style share links: /r/<sub>/s/<id>
    /^(https?:\/\/)?(www\.)?reddit\.com\/(?:r|user|u)\/[\w.-]+\/s\/[\w]+/,
    /^(https?:\/\/)?v\.redd\.it\/[\w]+/,
    /^(https?:\/\/)?redd\.it\/[\w]+/,
  ],
  threads: [
    /^(https?:\/\/)?(www\.)?threads\.(net|com)\/@[\w.-]+\/post\/[\w-]+/,
    /^(https?:\/\/)?(www\.)?threads\.(net|com)\/t\/[\w-]+/,
  ],
  snapchat: [
    /^(https?:\/\/)?(www\.)?snapchat\.com\/(?:spotlight|t|p|add|u)\/[\w.@/-]+/,
    /^(https?:\/\/)?story\.snapchat\.com\/[\w/@-]+/,
  ],
  twitch: [
    /^(https?:\/\/)?(www\.|m\.)?twitch\.tv\/[\w]+\/clip\/[\w-]+/,
    /^(https?:\/\/)?clips\.twitch\.tv\/[\w-]+/,
    /^(https?:\/\/)?(www\.|m\.)?twitch\.tv\/videos\/\d+/,
  ],
  vimeo: [
    /^(https?:\/\/)?(www\.|player\.)?vimeo\.com\/(?:video\/)?\d+/,
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
 * Recognise an Instagram story or highlight URL and pull out what we need to
 * fetch it. Returns null for ordinary post/reel URLs.
 *   /stories/<username>/<storyPk>/        → { username, storyPk }
 *   /stories/highlights/<highlightId>/    → { highlightId }
 */
export function parseInstagramStory(
  url: string,
): { username?: string; storyPk?: string; highlightId?: string } | null {
  const hi = url.match(/instagram\.com\/stories\/highlights\/(\d+)/)
  if (hi) return { highlightId: hi[1] }
  const st = url.match(/instagram\.com\/stories\/([\w.-]+)\/(\d+)/)
  if (st) return { username: st[1], storyPk: st[2] }
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
