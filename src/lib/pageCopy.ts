import { PRO_BENEFITS } from '@/config/pro'
import { siteConfig } from '@/config/site'
import { WHATS_NEW } from '@/config/whatsNew'
import { legalCopy } from '@/lib/legalCopy'

/**
 * The English words on the home and platform pages, and the shape every language
 * in src/content/locales has to match. `{name}` tokens go through `fill`.
 *
 * Server only: this reaches a visitor as HTML, never as JavaScript.
 */
export const pageCopy = {
  nav: {
    home: 'Home',
    breadcrumb: 'Breadcrumb',
    otherDownloaders: 'Other downloaders',
    perPlatform: 'Per-platform downloaders',
    currentPage: '(current page)',
    allPlatforms: '← All platforms',
  },
  chips: {
    free: 'Free forever',
    noLoginToDownload: 'No login to download',
    noLoginRequired: 'No login required',
    noLimits: 'No download limits',
    hd: 'HD quality',
    anyLink: 'Any public link',
  },
  home: {
    metaTitle: 'Social Media Video Downloader — Save Any Public Video in HD',
    metaDescription:
      'Free social media video downloader for TikTok, X, Instagram, Facebook, YouTube and more. Save HD video, MP3 audio and photo galleries with no login.',
    heroLabels: {
      'tiktok-downloader': 'TikTok video downloader',
      'twitter-video-downloader': 'Twitter/X video downloader',
      'instagram-downloader': 'Instagram reels & photo downloader',
      'facebook-downloader': 'Facebook video & reels downloader',
      'youtube-downloader': 'YouTube & Shorts downloader',
    },
    h1Lead: 'Download any public video,',
    h1Accent: 'in original quality',
    intro:
      'Save the video, extract MP3 audio, or grab full image galleries from public posts on TikTok, X, Instagram, Facebook, YouTube, Pinterest, Reddit, Threads, Snapchat, Twitch, Vimeo, Dailymotion & LinkedIn.',
    featuresTitle: 'Everything from one link',
    featuresSub:
      'One paste, four ways to save it. No app, no account, nothing installed.',
    features: {
      video: {
        label: 'HD video',
        sub: 'The full-quality source MP4, not a screen recording — seeking works.',
      },
      audio: {
        label: 'MP3 audio',
        sub: 'Pull the soundtrack — perfect for trending sounds.',
      },
      gallery: {
        label: 'Photo galleries',
        sub: 'Carousels come through at full resolution to pick from.',
      },
      zip: {
        label: 'Batch ZIP',
        sub: 'Grab every image in a slideshow as one download.',
      },
    },
    stepsTitle: 'Three steps, a few seconds',
    stepsSub: 'No tutorials. No settings. Paste and go.',
    steps: [
      {
        title: 'Copy a video URL',
        sub: 'TikTok, X, Instagram, YouTube — or any public video link.',
      },
      {
        title: 'Paste & download',
        sub: 'We resolve the media in seconds — right in your browser.',
      },
      {
        title: 'Save it',
        sub: 'Video, MP3, or the full image gallery. Done.',
      },
    ],
    jumpTitle: 'Jump to a dedicated downloader',
    jumpSub: 'Prefer a page built for one platform? Pick yours.',
    whyEyebrow: 'Why it works',
    seoTitle: 'Free TikTok, X, Instagram, Facebook & YouTube Video Downloader',
    seoParagraphs: [
      'Save any public TikTok, Twitter/X, Instagram, Facebook, or YouTube post in a couple of clicks. Paste the link, preview the content, and download the full-quality video, the original MP3 soundtrack, or every image from a photo carousel.',
      'Everything happens in your browser — no app, no sign-up, and no limit on how much you save. Only publicly visible posts are reachable, and you are responsible for having the rights to whatever you download.',
    ],
    formatsEyebrow: 'Supported link formats',
    faqTitle: 'Frequently asked questions',
    whatsNew: WHATS_NEW.map(({ date, title, detail }) => ({ date, title, detail })),
    whatsNewTitle: 'Recently added',
    whatsNewSub:
      'The tool is under active development — here is what changed lately.',
  },
  landing: {
    featuresTitle: 'With this {name} downloader you can',
    othersTitle: 'Also try our other downloaders',
    othersSub: 'One tool per platform — pick whichever you need.',
    whyEyebrow: 'Why it works',
    seoTitle: 'Free {brand} — {tagline}',
    formatsEyebrow: 'Supported {name} URL formats',
    faqTitle: '{name} downloader — Frequently asked questions',
    stepsTitle: 'How to download {name} videos',
  },
  support: {
    compactTitle: 'This site is free and has no limits.',
    compactBody:
      'Keeping the resolvers up costs money. ${monthly} a month covers a slice of it, and switches on the batch queue.',
    coffee: 'Support this',
    title: 'Free forever. Not free to run.',
    body: 'Every download here is free, with no account and no limits, and that is not changing. A membership covers a slice of what it costs to keep the resolvers up — and switches these four on for you.',
    monthly: 'Support this — ${monthly}/month',
    lifetime: 'Or ${lifetime} once, forever',
    note: 'Support is arranged by email for now. Cancel any time with one email.',
    allBenefits: 'See all {count} features',
    benefits: PRO_BENEFITS.map(({ title, body }) => ({ title, body })),
  },
  footer: {
    builtBy: 'Built by',
    portfolio: 'Portfolio',
    privacy: 'Privacy',
    terms: 'Terms',
    support: 'Support',
    languages: 'Languages',
    questions: 'Questions or takedown notices:',
    disclaimer:
      'Public posts only. {site} is an independent tool, not affiliated with or endorsed by TikTok, X, Instagram, Facebook, YouTube, Pinterest, Reddit, Threads, Snapchat, Twitch, Vimeo, Dailymotion, LinkedIn or Telegram; their names and logos belong to their owners and identify which links this tool accepts.',
  },
  legal: legalCopy,
  howTo: {
    homeName:
      'How to download a public TikTok, X, Instagram, Facebook or YouTube video',
    homeDescription:
      'Save any public TikTok, Twitter/X, Instagram, Facebook, or YouTube video, MP3 audio, or carousel image in three steps — no login, no install.',
    homeSupply: 'TikTok, Twitter/X, Instagram, Facebook or YouTube post URL',
    homeTool: 'A TikTok, Twitter/X, Instagram, Facebook or YouTube URL',
    browserTool: 'Any modern web browser',
    platformName: 'How to download from {name}',
    platformDescription:
      'Save any public {name} video, photo, or MP3 in four steps — no login, no install.',
    platformSupply: 'A public {name} post URL',
    platformTool: 'A {name} post URL',
  },
  // The WebApplication JSON-LD node, which names the site in the page's language.
  webApp: {
    description: siteConfig.description,
    browserRequirements: 'Requires JavaScript. Requires HTML5.',
    featureList: [
      'Download public TikTok videos in HD',
      'Download Twitter/X videos in HD (including GIF videos)',
      'Download Instagram reels, videos and photos',
      'Download YouTube videos and Shorts in HD',
      'Download Facebook videos, watch clips and reels in HD',
      'Extract MP3 audio from TikTok, YouTube and Facebook videos',
      'Download TikTok slideshows (photo carousels) with original music',
      'Download Instagram photo carousels — every image individually or as a ZIP',
      'Preview video, audio and images before downloading',
      'Save images individually or as a ZIP archive',
      'Works on desktop, iPhone, iPad and Android — no app install',
      'No login, no daily limit, no signup',
    ],
    // From the page list, so a new platform page is named without an edit.
    dedicated: 'Dedicated downloaders for {platforms}',
  },
}

export type PageCopy = typeof pageCopy
