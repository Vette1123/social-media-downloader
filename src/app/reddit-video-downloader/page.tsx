import { PlatformLanding } from '@/components/PlatformLanding'
import { platformMetadata } from '@/lib/pageMetadata'

export const metadata = platformMetadata('reddit-video-downloader')

export default function Page() {
  return <PlatformLanding slug='reddit-video-downloader' />
}
