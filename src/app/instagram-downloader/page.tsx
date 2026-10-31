import { PlatformLanding } from '@/components/PlatformLanding'
import { platformMetadata } from '@/lib/pageMetadata'

export const metadata = platformMetadata('instagram-downloader')

export default function Page() {
  return <PlatformLanding slug='instagram-downloader' />
}
