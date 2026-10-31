import { PlatformLanding } from '@/components/PlatformLanding'
import { platformMetadata } from '@/lib/pageMetadata'

export const metadata = platformMetadata('youtube-downloader')

export default function Page() {
  return <PlatformLanding slug='youtube-downloader' />
}
