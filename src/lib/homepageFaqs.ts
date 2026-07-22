// Single source of truth for the homepage FAQ.
//
// Consumed by BOTH the visible <LazyFAQ> on the homepage (src/app/page.tsx) and
// the FAQPage structured data (src/lib/structuredData.ts). Keeping one array
// guarantees the rendered Q&A and the schema markup stay in lock-step — Google
// expects FAQPage content to match what the user actually sees on the page.

export interface HomepageFaq {
  q: string
  a: string
}

export const homepageFaqs: HomepageFaq[] = [
  {
    q: 'Is this TikTok downloader free?',
    a: 'Yes. The tool is completely free, requires no sign-up or account, and has no daily download limit.',
  },
  {
    q: 'Do downloaded TikTok videos have a watermark?',
    a: 'No. Videos are saved in original HD quality (up to 1080p) without the TikTok watermark.',
  },
  {
    q: 'Can I download a TikTok photo carousel (slideshow)?',
    a: 'Yes. Paste the slideshow URL and the app shows every image plus the original background music — download them individually, as a ZIP archive, or save the audio as an MP3.',
  },
  {
    q: 'Does it support Twitter/X videos?',
    a: 'Yes. Paste any twitter.com or x.com status URL and the tool will extract the video for preview and download — including GIF videos in HD.',
  },
  {
    q: 'Can I download Instagram reels and photos?',
    a: 'Yes. Paste a public Instagram post, reel, or carousel URL (instagram.com/p/… or instagram.com/reel/…) and the tool extracts the video, the single photo, or every image in a carousel — no login required. Private accounts and stories are not supported.',
  },
  {
    q: 'Can I download YouTube videos and Shorts?',
    a: 'Yes. Paste any youtube.com/watch?v=…, youtu.be/…, or /shorts/… link and the tool resolves the stream so you can preview it, download the MP4 in HD, or extract the audio as an MP3. Age-restricted, private, and members-only videos are not supported.',
  },
  {
    q: 'Does it support Facebook videos and reels?',
    a: 'Yes. Paste a public Facebook video, watch, or reel URL (facebook.com/…/videos/…, fb.watch/…, or facebook.com/reel/…) and the tool extracts the HD stream for preview and download. Private posts and videos from private groups are not supported.',
  },
  {
    q: 'Does it work on iPhone, iPad and Android?',
    a: 'Yes. It runs entirely in the browser on any modern device — iPhone, iPad, Android phone, tablet, Mac, Windows or Linux. No app install required.',
  },
  {
    q: 'What formats and quality are downloads available in?',
    a: 'Videos are downloaded as MP4 in HD (typically 1080p when the source supports it). Audio is delivered as MP3. Carousel images are saved as JPG or PNG, individually or in a ZIP archive.',
  },
  {
    q: 'Do you store the videos I download?',
    a: 'No. The tool fetches media on demand and streams it directly to your device. Nothing is stored on our servers and no account is needed.',
  },
  {
    q: 'Is downloading TikTok, Twitter/X, Instagram, Facebook or YouTube videos legal?',
    a: 'Downloading public videos for personal, non-commercial use is generally allowed, but you should respect the original creator’s rights and the platform’s terms of service. Do not redistribute or monetize content you do not own.',
  },
  {
    q: 'Why does my TikTok link fail to process?',
    a: 'Make sure the post is public and the URL is the share link (tiktok.com/@user/video/... or vm.tiktok.com/...). Private, deleted, region-locked or age-restricted posts cannot be fetched.',
  },
]
