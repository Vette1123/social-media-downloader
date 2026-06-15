import {
  ogImageContentType,
  ogImageSize,
  renderPlatformOgImage,
} from '@/lib/platformOgImage'
import { platformsBySlug } from '@/lib/platforms'

export const runtime = 'edge'
export const alt = `${platformsBySlug['facebook-downloader'].brandLabel} — ${platformsBySlug['facebook-downloader'].tagline}`
export const size = ogImageSize
export const contentType = ogImageContentType

export default function OpenGraphImage() {
  return renderPlatformOgImage('facebook-downloader')
}
