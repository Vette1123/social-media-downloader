import { PlatformLanding } from '@/components/PlatformLanding'
import { platformMetadata } from '@/lib/pageMetadata'

export const metadata = platformMetadata('linkedin-video-downloader')

export default function Page() {
  return <PlatformLanding slug='linkedin-video-downloader' />
}
