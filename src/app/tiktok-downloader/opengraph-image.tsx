import {
  ogImageContentType,
  ogImageSize,
  renderPlatformOgImage,
} from '@/lib/platformOgImage'
import { platformsBySlug } from '@/lib/platforms'

export const runtime = 'edge'
export const alt = `${platformsBySlug['tiktok-downloader'].brandLabel} — ${platformsBySlug['tiktok-downloader'].tagline}`
export const size = ogImageSize
export const contentType = ogImageContentType

export default function OpenGraphImage() {
  return renderPlatformOgImage('tiktok-downloader')
}
