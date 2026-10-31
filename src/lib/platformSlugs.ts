/** The URL slugs alone, so client code can name a page without its 42 KB of copy. */
export const PLATFORM_SLUGS = [
  'video-downloader',
  'tiktok-downloader',
  'twitter-video-downloader',
  'instagram-downloader',
  'youtube-downloader',
  'facebook-downloader',
  'pinterest-downloader',
  'reddit-video-downloader',
  'threads-video-downloader',
  'snapchat-downloader',
  'twitch-clip-downloader',
  'vimeo-downloader',
] as const

export type PlatformSlug = (typeof PLATFORM_SLUGS)[number]
