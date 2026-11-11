import { notFound } from 'next/navigation'
import { ogCardLocale } from '@/lib/ogCopy'
import {
  ogImageContentType,
  ogImageSize,
  renderPlatformOgImage,
} from '@/lib/platformOgImage'
import { PLATFORM_SLUGS, type PlatformSlug } from '@/lib/platformSlugs'
import { toRouteLocale } from '@/lib/routeLocale'

export const dynamic = 'force-static'
export const size = ogImageSize
export const contentType = ogImageContentType

interface Props {
  params: Promise<{ lang: string; slug: string }>
}

export function generateStaticParams() {
  return PLATFORM_SLUGS.map((slug) => ({ slug }))
}

function toSlug(slug: string): PlatformSlug {
  if (!(PLATFORM_SLUGS as readonly string[]).includes(slug)) notFound()
  return slug as PlatformSlug
}

export default async function OpenGraphImage({ params }: Props) {
  const { lang, slug } = await params
  return renderPlatformOgImage(toSlug(slug), ogCardLocale(toRouteLocale(lang)))
}
