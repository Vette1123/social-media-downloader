import { siteConfig } from '@/config/site'
import { OG_SIZE } from '@/lib/ogKit'
import { renderProOgImage } from '@/lib/proOgImage'

export const dynamic = 'force-static'
export const alt = `${siteConfig.name} Pro: batch downloads, ZIP bundles, priority resolving`
export const size = OG_SIZE
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return renderProOgImage()
}
