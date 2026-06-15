import { siteConfig } from '@/config/site'

export type PlatformSlug =
  | 'tiktok-downloader'
  | 'twitter-video-downloader'
  | 'instagram-downloader'
  | 'youtube-downloader'
  | 'facebook-downloader'

export interface PlatformSeoCard {
  title: string
  body: string
}

export interface PlatformFaq {
  q: string
  a: string
}

export interface Platform {
  slug: PlatformSlug
  name: string
  brandLabel: string
  metaTitle: string
  metaDescription: string
  h1: string
  tagline: string
  intro: string
  accent: {
    chip: string
    grad: string
    ring: string
    glow: string
  }
  urlExamples: string[]
  cards: PlatformSeoCard[]
  faqs: PlatformFaq[]
  featureList: string[]
}

export const platforms: Platform[] = [
  {
    slug: 'tiktok-downloader',
    name: 'TikTok',
    brandLabel: 'TikTok video downloader',
    metaTitle:
      'TikTok Video Downloader — HD, No Watermark, Free MP3 & Slideshow',
    metaDescription:
      'Download TikTok videos in HD without a watermark, extract the soundtrack as MP3, or save every image from a TikTok photo carousel — free, no login, no app install.',
    h1: 'TikTok Video Downloader — HD, No Watermark',
    tagline:
      'Save TikTok videos in 1080p, extract MP3 audio, and download photo carousels with their original music.',
    intro:
      'Paste any tiktok.com or vm.tiktok.com link to download the video without a watermark, pull the soundtrack as an MP3, or save every image from a TikTok photo carousel — individually or as a single ZIP. Everything happens in your browser, no app to install and no sign-up.',
    accent: {
      chip: 'bg-[#010101] text-white',
      grad: 'from-pink-500 via-fuchsia-500 to-rose-500',
      ring: 'ring-pink-500/30',
      glow: 'shadow-pink-500/30',
    },
    urlExamples: [
      'tiktok.com/@user/video/…',
      'vm.tiktok.com/…',
      'tiktok.com/t/…',
      'm.tiktok.com/v/…',
    ],
    cards: [
      {
        title: '🎬 HD video, no watermark',
        body: 'Get TikTok clips in original 1080p quality, stripped of the corner watermark — perfect for re-editing, archiving, or sharing off-platform.',
      },
      {
        title: '🎵 MP3 from any TikTok',
        body: 'Pull the soundtrack from any video or slideshow as an MP3. Trending sound? Grab it in seconds without screen-recording.',
      },
      {
        title: '🖼️ Photo carousels',
        body: 'TikTok slideshows return as a full gallery. Preview each image, pick favorites, then save individually or as a ZIP — original music included.',
      },
    ],
    faqs: [
      {
        q: 'Is this TikTok downloader free?',
        a: 'Yes — completely free, with no sign-up and no daily download limit.',
      },
      {
        q: 'Do downloaded TikTok videos have a watermark?',
        a: 'No. Videos are saved in HD quality, free of the TikTok watermark.',
      },
      {
        q: 'Can I download a TikTok photo carousel (slideshow)?',
        a: 'Yes. Paste the slideshow URL and the app lists every image, the background track, and — when TikTok provides one — the rendered slideshow video, so you can grab the photos, the MP3, or the MP4 in one flow.',
      },
      {
        q: 'How do I extract MP3 audio from a TikTok video?',
        a: 'Paste the TikTok URL, click Process URL, then use the Extract Audio button. The MP3 is delivered straight to your device — no screen-recording needed.',
      },
      {
        q: 'Why does my TikTok link fail to process?',
        a: 'Make sure the post is public and the URL is the share link (tiktok.com/@user/video/… or vm.tiktok.com/…). Private, deleted, region-locked, or age-restricted posts cannot be fetched.',
      },
    ],
    featureList: [
      'Download TikTok videos in HD without the watermark',
      'Extract MP3 audio from any TikTok video or slideshow',
      'Save TikTok photo carousels — individually or as a ZIP',
      'Preview the video and audio before downloading',
      'No login, no app install, no daily download limit',
    ],
  },
  {
    slug: 'twitter-video-downloader',
    name: 'Twitter / X',
    brandLabel: 'Twitter/X video downloader',
    metaTitle: 'Twitter / X Video Downloader — Save HD Videos & GIFs',
    metaDescription:
      'Save any Twitter or X video in HD, including GIF videos and longer posts. Paste a twitter.com or x.com status URL and download the MP4 instantly — no login.',
    h1: 'Twitter / X Video Downloader — HD MP4 & GIF',
    tagline:
      'Save Twitter videos, X clips, and GIF tweets as MP4 in their original quality.',
    intro:
      'Paste any twitter.com or x.com status URL and the tool resolves the underlying media — HD video, GIF, or multi-attachment thread — so you can preview and download the MP4 directly to your device. No login, no extensions, nothing installed.',
    accent: {
      chip: 'bg-black text-white',
      grad: 'from-sky-500 via-blue-500 to-indigo-500',
      ring: 'ring-sky-500/30',
      glow: 'shadow-sky-500/30',
    },
    urlExamples: [
      'x.com/user/status/…',
      'twitter.com/user/status/…',
      'mobile.twitter.com/…',
      't.co/…',
    ],
    cards: [
      {
        title: '🎬 HD MP4 downloads',
        body: 'Get the highest available bitrate of any tweet video — including longer-form posts and clips on X Premium accounts.',
      },
      {
        title: '🌀 GIF tweets → MP4',
        body: 'Twitter "GIFs" are really H.264 MP4s. The tool extracts them as a clean MP4 you can replay, edit, or convert.',
      },
      {
        title: '🔁 twitter.com & x.com',
        body: 'Both legacy twitter.com URLs and the new x.com URLs are supported. Paste either — the underlying status ID is what matters.',
      },
    ],
    faqs: [
      {
        q: 'Does this work for both twitter.com and x.com?',
        a: 'Yes. The tool extracts the status ID from either domain, so legacy twitter.com links and new x.com links both work.',
      },
      {
        q: 'Can I download a Twitter GIF as a video?',
        a: 'Yes. Twitter GIFs are stored as H.264 MP4s — the tool downloads them as clean MP4 files in their original quality.',
      },
      {
        q: 'What quality are downloaded Twitter videos?',
        a: 'You get the highest bitrate the original post offers — typically 720p or 1080p for HD clips, and up to the source quality for longer X Premium posts.',
      },
      {
        q: 'Do I need to log in or follow the account?',
        a: 'No. The tool fetches only what the post exposes publicly. If a post is from a protected account, it can\'t be downloaded.',
      },
      {
        q: 'Why does my Twitter link fail to process?',
        a: 'Make sure the tweet is public and the URL is a status link (twitter.com/user/status/… or x.com/user/status/…). Deleted, protected, or geo-restricted posts can\'t be fetched.',
      },
    ],
    featureList: [
      'Download Twitter and X videos in HD',
      'Save GIF tweets as clean MP4 files',
      'Works with both twitter.com and x.com URLs',
      'No login, no Twitter API key, no install',
      'Preview the video before downloading',
    ],
  },
  {
    slug: 'instagram-downloader',
    name: 'Instagram',
    brandLabel: 'Instagram reels & photo downloader',
    metaTitle:
      'Instagram Reels & Photo Downloader — HD, No Login, Free Carousel',
    metaDescription:
      'Download Instagram reels in HD, save single photos, or pull every image from a carousel post — no Instagram login, no app install. Free, no daily limit.',
    h1: 'Instagram Reels & Photo Downloader — Free, No Login',
    tagline:
      'Save Instagram reels, photos, and carousel posts in their original resolution.',
    intro:
      'Paste a public Instagram URL — a reel, a single photo, or a carousel — and the tool extracts the media in its original resolution. Carousels return every image individually so you can pick the ones you want or save them all as a ZIP. No Instagram login required.',
    accent: {
      chip:
        'bg-gradient-to-br from-[#FEDA75] via-[#D62976] to-[#4F5BD5] text-white',
      grad: 'from-fuchsia-500 via-pink-500 to-orange-500',
      ring: 'ring-fuchsia-500/30',
      glow: 'shadow-fuchsia-500/30',
    },
    urlExamples: [
      'instagram.com/p/…',
      'instagram.com/reel/…',
      'instagram.com/reels/…',
      'instagram.com/tv/…',
    ],
    cards: [
      {
        title: '🎬 Reels in HD',
        body: 'Save Instagram reels in their full source resolution — vertical, square, or landscape — with no platform watermark stitched on.',
      },
      {
        title: '🖼️ Single photos',
        body: 'Public Instagram photo posts return at full size — no thumbnail compression, no UI screenshot needed.',
      },
      {
        title: '🗂️ Photo carousels',
        body: 'Carousel posts come through as a gallery. Pick the images you want and save them one by one, or download the whole set as a ZIP.',
      },
    ],
    faqs: [
      {
        q: 'Can I download Instagram reels in HD?',
        a: 'Yes — reels are saved at their source resolution and the original aspect ratio is preserved.',
      },
      {
        q: 'Does it work on Instagram photo carousels?',
        a: 'Yes. Paste a /p/ URL containing multiple photos and every image is listed individually — download them all as a ZIP or just the ones you want.',
      },
      {
        q: 'Do I need to log into Instagram?',
        a: 'No. The tool only accesses publicly visible posts. Private accounts, stories, and DMs are out of scope.',
      },
      {
        q: 'Can I download Instagram stories?',
        a: 'No. Stories are not in scope — only public feed posts, reels, IGTV, and carousels are supported.',
      },
      {
        q: 'Does Instagram see who downloaded a post?',
        a: 'No. There is no "downloaded by" signal exposed to creators. That said, please respect the original creator and Instagram\'s terms when re-using content.',
      },
    ],
    featureList: [
      'Download Instagram reels in HD',
      'Save single Instagram photos at full resolution',
      'Pull every image from a carousel — individually or as ZIP',
      'No Instagram login required',
      'Public posts only — private accounts and stories not supported',
    ],
  },
  {
    slug: 'youtube-downloader',
    name: 'YouTube',
    brandLabel: 'YouTube & Shorts downloader',
    metaTitle: 'YouTube & Shorts Downloader — MP4 HD & MP3 Audio',
    metaDescription:
      'Download YouTube videos and Shorts in HD as MP4, or extract the audio as MP3. Paste youtube.com/watch, youtu.be, or /shorts/ links — no install.',
    h1: 'YouTube & Shorts Downloader — MP4 HD & MP3',
    tagline:
      'Save YouTube videos and Shorts as HD MP4 or extract clean MP3 audio.',
    intro:
      'Paste any youtube.com/watch?v=…, youtu.be/…, or /shorts/… link. The tool resolves the stream so you can preview it, save the MP4 in HD, or pull the soundtrack as an MP3 — useful for podcasts, lectures, or trending audio. Age-restricted, private, and members-only videos aren\'t supported.',
    accent: {
      chip: 'bg-[#FF0000] text-white',
      grad: 'from-red-500 via-rose-500 to-pink-500',
      ring: 'ring-red-500/30',
      glow: 'shadow-red-500/30',
    },
    urlExamples: [
      'youtube.com/watch?v=…',
      'youtu.be/…',
      'youtube.com/shorts/…',
      'm.youtube.com/watch?v=…',
    ],
    cards: [
      {
        title: '🎬 HD MP4 video',
        body: 'Get the highest available MP4 quality — up to 1080p where the source supports it — without a browser extension or installed app.',
      },
      {
        title: '🎵 MP3 audio extract',
        body: 'Pull just the soundtrack as a clean MP3. Perfect for music, lectures, podcasts, and language-learning clips.',
      },
      {
        title: '⚡ Shorts ready',
        body: 'Vertical YouTube Shorts (/shorts/…) are first-class citizens — saved in their native 9:16 aspect ratio at source resolution.',
      },
    ],
    faqs: [
      {
        q: 'Can I download YouTube Shorts?',
        a: 'Yes — paste any youtube.com/shorts/… link and the tool resolves the stream so you can preview it, download the MP4, or extract the MP3.',
      },
      {
        q: 'Can I extract just the MP3 audio?',
        a: 'Yes. Click Extract Audio after processing to download a clean MP3 instead of (or alongside) the video.',
      },
      {
        q: 'What\'s the maximum quality?',
        a: 'Up to 1080p MP4 when the source supports it. Some videos top out at 720p depending on the original upload.',
      },
      {
        q: 'Does it work on age-restricted or members-only videos?',
        a: 'No. Age-restricted, private, members-only, and region-blocked videos can\'t be fetched.',
      },
      {
        q: 'Why does my video only load as a preview?',
        a: 'Some YouTube videos restrict free extraction. In that case the tool falls back to an embedded preview so you can still watch it inline.',
      },
    ],
    featureList: [
      'Download YouTube videos as HD MP4',
      'Save YouTube Shorts in native vertical format',
      'Extract MP3 audio from any video',
      'Preview before downloading',
      'No browser extension, no install',
    ],
  },
  {
    slug: 'facebook-downloader',
    name: 'Facebook',
    brandLabel: 'Facebook video & reels downloader',
    metaTitle: 'Facebook Video & Reels Downloader — HD, No Login',
    metaDescription:
      'Save any public Facebook video, watch clip, or reel in HD. Paste a facebook.com/.../videos/, fb.watch, or /reel/ URL — no login or extension required.',
    h1: 'Facebook Video & Reels Downloader — HD, No Login',
    tagline:
      'Download Facebook videos, watch clips, and reels in HD straight to your device.',
    intro:
      'Paste any public Facebook video, watch clip, or reel URL — facebook.com/…/videos/…, fb.watch/…, or facebook.com/reel/… — and the tool extracts the HD stream for preview and download. No Facebook login, no extension, no app required. Private posts and videos from private groups can\'t be fetched.',
    accent: {
      chip: 'bg-[#1877F2] text-white',
      grad: 'from-blue-500 via-sky-500 to-cyan-500',
      ring: 'ring-blue-500/30',
      glow: 'shadow-blue-500/30',
    },
    urlExamples: [
      'facebook.com/.../videos/…',
      'fb.watch/…',
      'facebook.com/reel/…',
      'facebook.com/watch/?v=…',
    ],
    cards: [
      {
        title: '🎬 HD video & watch clips',
        body: 'Public Facebook videos and Watch clips come through at the source resolution they were uploaded with — typically 720p or 1080p.',
      },
      {
        title: '🎞️ Reels — native vertical',
        body: 'Facebook Reels are saved in their native 9:16 vertical format, ready for re-sharing or archiving.',
      },
      {
        title: '🔗 fb.watch short links',
        body: 'Short fb.watch URLs work the same as full facebook.com URLs — the tool resolves the short link to the underlying video automatically.',
      },
    ],
    faqs: [
      {
        q: 'Does this work on Facebook Reels?',
        a: 'Yes — paste a facebook.com/reel/… URL and the tool extracts the video in its native vertical format.',
      },
      {
        q: 'Can I download videos from Facebook Watch?',
        a: 'Yes. Watch clips (facebook.com/watch/?v=…) and embedded videos in posts are both supported.',
      },
      {
        q: 'Do private Facebook videos work?',
        a: 'No. Only public posts, public reels, and public Watch clips can be downloaded. Private posts and videos from private groups aren\'t in scope.',
      },
      {
        q: 'What URL formats are supported?',
        a: 'facebook.com/.../videos/…, fb.watch/…, facebook.com/reel/…, and facebook.com/watch/?v=… all work — paste any of them.',
      },
      {
        q: 'Will the original poster know I downloaded their video?',
        a: 'No — there\'s no "downloaded by" notification. Please respect the creator and Facebook\'s terms when re-using their content.',
      },
    ],
    featureList: [
      'Download Facebook videos in HD',
      'Save Facebook Reels in native vertical format',
      'Works with fb.watch short links',
      'Public posts only — no login, no extension',
      'Preview the video before downloading',
    ],
  },
]

export const platformsBySlug: Record<PlatformSlug, Platform> = platforms.reduce(
  (acc, p) => {
    acc[p.slug] = p
    return acc
  },
  {} as Record<PlatformSlug, Platform>,
)

export function platformUrl(slug: PlatformSlug): string {
  return `${siteConfig.url}/${slug}`
}
