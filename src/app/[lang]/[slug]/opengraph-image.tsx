import { notFound } from 'next/navigation'
import { arOgCardResponse } from '@/lib/arOgCards'
import { ogCardLocale } from '@/lib/ogCopy'
import {
  ogImageContentType,
  ogImageSize,
  renderPlatformOgImage,
} from '@/lib/platformOgImage'
import { PLATFORM_SLUGS, type PlatformSlug } from '@/lib/platformSlugs'
import { ROUTE_LOCALES } from '@/lib/localeRoutes'
import { toRouteLocale } from '@/lib/routeLocale'

export const dynamic = 'force-static'
export const size = ogImageSize
export const contentType = ogImageContentType

interface Props {
  params: Promise<{ lang: string; slug: string }>
}

// An image route does not inherit its parent's params under `output: export`:
// it must name every dynamic segment itself, `lang` included.
export function generateStaticParams() {
  return ROUTE_LOCALES.flatMap((lang) => PLATFORM_SLUGS.map((slug) => ({ lang, slug })))
}

function toSlug(slug: string): PlatformSlug {
  if (!(PLATFORM_SLUGS as readonly string[]).includes(slug)) notFound()
  return slug as PlatformSlug
}

export default async function OpenGraphImage({ params }: Props) {
  const { lang, slug } = await params
  const locale = toRouteLocale(lang)
  if (locale === 'ar') return arOgCardResponse(toSlug(slug))
  return renderPlatformOgImage(toSlug(slug), ogCardLocale(locale))
}
