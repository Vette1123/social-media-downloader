import { siteConfig } from '@/config/site'
import { homeOgSize, renderHomeOgImage } from '@/lib/homeOgImage'
import { ogCardLocale } from '@/lib/ogCopy'
import { toRouteLocale } from '@/lib/routeLocale'

export const dynamic = 'force-static'
export const alt = siteConfig.name
export const size = homeOgSize
export const contentType = 'image/png'

export default async function OpenGraphImage({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  return renderHomeOgImage(ogCardLocale(toRouteLocale((await params).lang)))
}
