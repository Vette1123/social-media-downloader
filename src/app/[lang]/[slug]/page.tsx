import { notFound } from 'next/navigation'
import { PlatformLanding } from '@/components/PlatformLanding'
import { platformMetadata } from '@/lib/pageMetadata'
import { PLATFORM_SLUGS, type PlatformSlug } from '@/lib/platformSlugs'
import { toRouteLocale } from '@/lib/routeLocale'

interface Props {
  params: Promise<{ lang: string; slug: string }>
}

export const dynamicParams = false

export function generateStaticParams() {
  return PLATFORM_SLUGS.map((slug) => ({ slug }))
}

function toSlug(slug: string): PlatformSlug {
  if (!(PLATFORM_SLUGS as readonly string[]).includes(slug)) notFound()
  return slug as PlatformSlug
}

export async function generateMetadata({ params }: Props) {
  const { lang, slug } = await params
  return platformMetadata(toSlug(slug), toRouteLocale(lang))
}

export default async function Page({ params }: Props) {
  const { lang, slug } = await params
  return <PlatformLanding slug={toSlug(slug)} locale={toRouteLocale(lang)} />
}
