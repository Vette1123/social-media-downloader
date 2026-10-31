import { PlatformLanding } from '@/components/PlatformLanding'
import { platformMetadata } from '@/lib/pageMetadata'

export const metadata = platformMetadata('tiktok-downloader')

export default function Page() {
  return <PlatformLanding slug='tiktok-downloader' />
}
