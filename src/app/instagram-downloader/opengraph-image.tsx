import {
  ogImageContentType,
  ogImageSize,
  renderPlatformOgImage,
} from '@/lib/platformOgImage'
import { platformsBySlug } from '@/lib/platforms'

export const dynamic = 'force-static'
export const alt = `${platformsBySlug['instagram-downloader'].brandLabel} — ${platformsBySlug['instagram-downloader'].tagline}`
export const size = ogImageSize
export const contentType = ogImageContentType

export default function OpenGraphImage() {
  return renderPlatformOgImage('instagram-downloader')
}
