import { siteConfig } from '@/config/site'
import type { Platform, PlatformSlug } from '@/lib/platforms'
import { platformsBySlug, platformUrl } from '@/lib/platforms'

const ogImage = siteConfig.ogImage
const datePublished = `${siteConfig.foundingYear}-01-01`
const dateModified = '2026-06-15'

const personNode = {
  '@type': 'Person',
  '@id': `${siteConfig.url}/#person`,
  name: siteConfig.author.name,
  url: siteConfig.author.url,
  email: `mailto:${siteConfig.author.email}`,
  jobTitle: siteConfig.author.jobTitle,
  sameAs: [
    siteConfig.links.twitter,
    siteConfig.links.github,
    siteConfig.links.portfolio,
  ],
}

const organizationNode = {
  '@type': 'Organization',
  '@id': `${siteConfig.url}/#organization`,
  name: siteConfig.name,
  alternateName: siteConfig.shortName,
  url: siteConfig.url,
  logo: {
    '@type': 'ImageObject',
    url: `${siteConfig.url}/favicon.svg`,
    contentUrl: `${siteConfig.url}/favicon.svg`,
    width: 512,
    height: 512,
  },
  image: ogImage,
  founder: { '@id': `${siteConfig.url}/#person` },
  foundingDate: datePublished,
  sameAs: [
    siteConfig.links.twitter,
    siteConfig.links.github,
    siteConfig.links.portfolio,
  ],
}

const websiteNode = {
  '@type': 'WebSite',
  '@id': `${siteConfig.url}/#website`,
  url: siteConfig.url,
  name: siteConfig.name,
  alternateName: siteConfig.shortName,
  description: siteConfig.description,
  inLanguage: 'en',
  publisher: { '@id': `${siteConfig.url}/#organization` },
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${siteConfig.url}/?url={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
}

const webApplicationNode = {
  '@type': ['WebApplication', 'SoftwareApplication'],
  '@id': `${siteConfig.url}/#webapp`,
  name: siteConfig.name,
  alternateName: siteConfig.shortName,
  url: siteConfig.url,
  description: siteConfig.description,
  applicationCategory: 'MultimediaApplication',
  applicationSubCategory: 'VideoDownloader',
  operatingSystem: 'Any',
  browserRequirements: 'Requires JavaScript. Requires HTML5.',
  softwareVersion: '1.0',
  datePublished,
  dateModified,
  isAccessibleForFree: true,
  inLanguage: 'en',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    priceValidUntil: '2099-12-31',
    availability: 'https://schema.org/InStock',
    url: siteConfig.url,
  },
  featureList: [
    'Download TikTok videos in HD without watermark',
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
    'No login, no daily limit, no watermark, no signup',
  ],
  screenshot: ogImage,
  image: ogImage,
  author: { '@id': `${siteConfig.url}/#person` },
  creator: { '@id': `${siteConfig.url}/#person` },
  publisher: { '@id': `${siteConfig.url}/#organization` },
  mainEntityOfPage: { '@id': `${siteConfig.url}/#website` },
  potentialAction: {
    '@type': 'UseAction',
    target: `${siteConfig.url}/?url={url}`,
    'query-input': 'required name=url',
  },
}

export const globalStructuredData = {
  '@context': 'https://schema.org',
  '@graph': [websiteNode, personNode, organizationNode, webApplicationNode],
}

const homepageFaqs = [
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

function faqPageNode(id: string, faqs: Array<{ q: string; a: string }>) {
  return {
    '@type': 'FAQPage',
    '@id': id,
    inLanguage: 'en',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }
}

function breadcrumbNode(
  id: string,
  items: Array<{ name: string; url: string }>,
) {
  return {
    '@type': 'BreadcrumbList',
    '@id': id,
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  }
}

function webPageNode({
  url,
  name,
  description,
  isPartOfId,
}: {
  url: string
  name: string
  description: string
  isPartOfId: string
}) {
  return {
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name,
    description,
    inLanguage: 'en',
    isPartOf: { '@id': isPartOfId },
    primaryImageOfPage: ogImage,
    publisher: { '@id': `${siteConfig.url}/#organization` },
    breadcrumb: { '@id': `${url}#breadcrumb` },
  }
}

const homepageHowToNode = {
  '@type': 'HowTo',
  '@id': `${siteConfig.url}/#howto`,
  name: 'How to download a TikTok, X, Instagram, Facebook or YouTube video without a watermark',
  description:
    'Save any TikTok, Twitter/X, Instagram, Facebook, or YouTube video, MP3 audio, or carousel image in three steps — no login, no install, no watermark.',
  totalTime: 'PT30S',
  image: ogImage,
  inLanguage: 'en',
  estimatedCost: {
    '@type': 'MonetaryAmount',
    currency: 'USD',
    value: '0',
  },
  supply: [
    {
      '@type': 'HowToSupply',
      name: 'TikTok, Twitter/X, Instagram, Facebook or YouTube post URL',
    },
  ],
  tool: [
    { '@type': 'HowToTool', name: 'Any modern web browser' },
    {
      '@type': 'HowToTool',
      name: 'A TikTok, Twitter/X, Instagram, Facebook or YouTube URL',
    },
  ],
  step: [
    {
      '@type': 'HowToStep',
      position: 1,
      name: 'Copy the link',
      text: 'Open the TikTok, Twitter/X, Instagram, Facebook or YouTube post and copy the share URL.',
      url: `${siteConfig.url}/#step-1`,
    },
    {
      '@type': 'HowToStep',
      position: 2,
      name: 'Paste and process',
      text: 'Paste the URL into the input on this page and click Process URL to fetch the media.',
      url: `${siteConfig.url}/#step-2`,
    },
    {
      '@type': 'HowToStep',
      position: 3,
      name: 'Download',
      text: 'Preview, then download the watermark-free video, MP3 audio, or carousel images individually or as a ZIP.',
      url: `${siteConfig.url}/#step-3`,
    },
  ],
}

export function homepageStructuredData() {
  const url = siteConfig.url
  return {
    '@context': 'https://schema.org',
    '@graph': [
      webPageNode({
        url,
        name: `${siteConfig.name} — ${siteConfig.tagline}`,
        description: siteConfig.description,
        isPartOfId: `${siteConfig.url}/#website`,
      }),
      breadcrumbNode(`${url}#breadcrumb`, [{ name: 'Home', url }]),
      homepageHowToNode,
      faqPageNode(`${url}#faq`, homepageFaqs),
    ],
  }
}

function platformHowToNode(p: Platform) {
  const url = platformUrl(p.slug)
  return {
    '@type': 'HowTo',
    '@id': `${url}#howto`,
    name: `How to download from ${p.name} without a watermark`,
    description: `Save any ${p.name} video, photo, or MP3 in three steps — no login, no install, no watermark.`,
    totalTime: 'PT30S',
    image: ogImage,
    inLanguage: 'en',
    estimatedCost: {
      '@type': 'MonetaryAmount',
      currency: 'USD',
      value: '0',
    },
    supply: [
      {
        '@type': 'HowToSupply',
        name: `A public ${p.name} post URL`,
      },
    ],
    tool: [
      { '@type': 'HowToTool', name: 'Any modern web browser' },
      { '@type': 'HowToTool', name: `A ${p.name} post URL` },
    ],
    step: [
      {
        '@type': 'HowToStep',
        position: 1,
        name: 'Copy the link',
        text: `Open the ${p.name} post and copy the share URL.`,
        url: `${url}#step-1`,
      },
      {
        '@type': 'HowToStep',
        position: 2,
        name: 'Paste and process',
        text: 'Paste the URL into the input on this page and click Process URL.',
        url: `${url}#step-2`,
      },
      {
        '@type': 'HowToStep',
        position: 3,
        name: 'Download',
        text: 'Preview, then save the watermark-free video, MP3, or images.',
        url: `${url}#step-3`,
      },
    ],
  }
}

export function platformStructuredData(slug: PlatformSlug) {
  const p = platformsBySlug[slug]
  const url = platformUrl(slug)
  return {
    '@context': 'https://schema.org',
    '@graph': [
      webPageNode({
        url,
        name: p.metaTitle,
        description: p.metaDescription,
        isPartOfId: `${siteConfig.url}/#website`,
      }),
      breadcrumbNode(`${url}#breadcrumb`, [
        { name: 'Home', url: siteConfig.url },
        { name: p.brandLabel, url },
      ]),
      platformHowToNode(p),
      faqPageNode(
        `${url}#faq`,
        p.faqs.map((f) => ({ q: f.q, a: f.a })),
      ),
    ],
  }
}
