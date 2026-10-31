import { PlatformLanding } from '@/components/PlatformLanding'
import { platformMetadata } from '@/lib/pageMetadata'

export const metadata = platformMetadata('vimeo-downloader')

export default function Page() {
  return <PlatformLanding slug='vimeo-downloader' />
}
