import { contentDay } from '@/config/build'
import { siteConfig } from '@/config/site'
import { fill, LOCALES, type Locale } from '@/lib/i18n'
import { contentFor, platformFor } from '@/lib/localeContent'
import { localePath } from '@/lib/localeRoutes'
import type { PageCopy } from '@/lib/pageCopy'
import type { Platform, PlatformSlug } from '@/lib/platforms'

const ogImage = siteConfig.ogImage
const datePublished = `${siteConfig.foundingYear}-01-01`
const dateModified = contentDay

const personNode = {
  '@type': 'Person',
  '@id': `${siteConfig.url}/#person`,
  name: siteConfig.author.name,
  url: siteConfig.author.url,
  email: `mailto:${siteConfig.supportEmail}`,
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
  inLanguage: LOCALES,
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
  inLanguage: LOCALES,
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    priceValidUntil: '2099-12-31',
    availability: 'https://schema.org/InStock',
    url: siteConfig.url,
  },
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

function faqPageNode(
  id: string,
  faqs: Array<{ q: string; a: string }>,
  locale: Locale,
) {
  return {
    '@type': 'FAQPage',
    '@id': id,
    inLanguage: locale,
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
  locale,
}: {
  locale: Locale
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
    inLanguage: locale,
    isPartOf: { '@id': isPartOfId },
    primaryImageOfPage: ogImage,
    publisher: { '@id': `${siteConfig.url}/#organization` },
    breadcrumb: { '@id': `${url}#breadcrumb` },
  }
}

function localizedUrl(locale: Locale, path: string): string {
  const localized = localePath(locale, path)
  return localized === '/' ? siteConfig.url : `${siteConfig.url}${localized}`
}

/** The three steps every page tells, differing only in the words. */
function howToNode({
  url,
  locale,
  name,
  description,
  supply,
  tool,
  steps,
  howTo,
}: {
  url: string
  locale: Locale
  name: string
  description: string
  supply: string
  tool: string
  steps: [string, string, string]
  howTo: PageCopy['howTo']
}) {
  const stepNames = [howTo.step1Name, howTo.step2Name, howTo.step3Name]
  // The home page's anchors sit on the bare origin, a platform's on its own URL.
  const anchor = url === siteConfig.url ? `${url}/` : url
  return {
    '@type': 'HowTo',
    '@id': `${anchor}#howto`,
    name,
    description,
    totalTime: 'PT30S',
    image: ogImage,
    inLanguage: locale,
    estimatedCost: {
      '@type': 'MonetaryAmount',
      currency: 'USD',
      value: '0',
    },
    supply: [{ '@type': 'HowToSupply', name: supply }],
    tool: [
      { '@type': 'HowToTool', name: howTo.browserTool },
      { '@type': 'HowToTool', name: tool },
    ],
    step: steps.map((text, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: stepNames[i],
      text,
      url: `${anchor}#step-${i + 1}`,
    })),
  }
}

export function homepageStructuredData(locale: Locale = 'en') {
  const url = localizedUrl(locale, '/')
  const { copy, homeFaqs } = contentFor(locale)
  const { howTo, home, nav } = copy
  const english = locale === 'en'
  return {
    '@context': 'https://schema.org',
    '@graph': [
      webPageNode({
        url,
        name: english ? `${siteConfig.name} — ${siteConfig.tagline}` : home.metaTitle,
        description: english ? siteConfig.description : home.metaDescription,
        isPartOfId: `${siteConfig.url}/#website`,
        locale,
      }),
      breadcrumbNode(`${url}#breadcrumb`, [{ name: nav.home, url }]),
      howToNode({
        url,
        locale,
        name: howTo.homeName,
        description: howTo.homeDescription,
        supply: howTo.homeSupply,
        tool: howTo.homeTool,
        steps: [howTo.homeStep1, howTo.homeStep2, howTo.homeStep3],
        howTo,
      }),
      faqPageNode(`${url}#faq`, homeFaqs, locale),
    ],
  }
}

function platformHowToNode(p: Platform, url: string, locale: Locale) {
  const { howTo } = contentFor(locale).copy
  const vars = { name: p.name }
  return howToNode({
    url,
    locale,
    name: fill(howTo.platformName, vars),
    description: fill(howTo.platformDescription, vars),
    supply: fill(howTo.platformSupply, vars),
    tool: fill(howTo.platformTool, vars),
    steps: [
      fill(howTo.platformStep1, vars),
      howTo.platformStep2,
      howTo.platformStep3,
    ],
    howTo,
  })
}

export function platformStructuredData(
  slug: PlatformSlug,
  locale: Locale = 'en',
) {
  const p = platformFor(locale, slug)
  const url = localizedUrl(locale, `/${slug}`)
  const { nav } = contentFor(locale).copy
  return {
    '@context': 'https://schema.org',
    '@graph': [
      webPageNode({
        url,
        name: p.metaTitle,
        description: p.metaDescription,
        isPartOfId: `${siteConfig.url}/#website`,
        locale,
      }),
      breadcrumbNode(`${url}#breadcrumb`, [
        { name: nav.home, url: localizedUrl(locale, '/') },
        { name: p.brandLabel, url },
      ]),
      platformHowToNode(p, url, locale),
      faqPageNode(
        `${url}#faq`,
        p.faqs.map((f) => ({ q: f.q, a: f.a })),
        locale,
      ),
    ],
  }
}
