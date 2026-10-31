import { PlatformLanding } from '@/components/PlatformLanding'
import { platformMetadata } from '@/lib/pageMetadata'

export const metadata = platformMetadata('twitter-video-downloader')

export default function Page() {
  return <PlatformLanding slug='twitter-video-downloader' />
}
