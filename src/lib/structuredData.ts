import { siteConfig } from '@/config/site'
import { homepageFaqs } from '@/lib/homepageFaqs'
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
