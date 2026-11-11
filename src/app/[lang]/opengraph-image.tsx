import { siteConfig } from '@/config/site'
import { homeOgSize, renderHomeOgImage } from '@/lib/homeOgImage'
import { arOgCardResponse } from '@/lib/arOgCards'
import { ogCardLocale } from '@/lib/ogCopy'
import { ROUTE_LOCALES } from '@/lib/localeRoutes'
import { toRouteLocale } from '@/lib/routeLocale'

export const dynamic = 'force-static'
export const alt = siteConfig.name
export const size = homeOgSize
export const contentType = 'image/png'

// An image route names its own params under `output: export`.
export function generateStaticParams() {
  return ROUTE_LOCALES.map((lang) => ({ lang }))
}

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const locale = toRouteLocale((await params).lang)
  if (locale === 'ar') return arOgCardResponse('home')
  return renderHomeOgImage(ogCardLocale(locale))
}
