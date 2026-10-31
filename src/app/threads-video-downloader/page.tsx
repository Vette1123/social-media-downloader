import { PlatformLanding } from '@/components/PlatformLanding'
import { platformMetadata } from '@/lib/pageMetadata'

export const metadata = platformMetadata('threads-video-downloader')

export default function Page() {
  return <PlatformLanding slug='threads-video-downloader' />
}
