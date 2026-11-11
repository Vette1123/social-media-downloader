import { siteConfig } from '@/config/site'
import { homeOgSize, renderHomeOgImage } from '@/lib/homeOgImage'

export const dynamic = 'force-static'
export const alt = siteConfig.name
export const size = homeOgSize
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return renderHomeOgImage('en')
}
