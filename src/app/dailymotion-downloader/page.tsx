import { PlatformLanding } from '@/components/PlatformLanding'
import { platformMetadata } from '@/lib/pageMetadata'

export const metadata = platformMetadata('dailymotion-downloader')

export default function Page() {
  return <PlatformLanding slug='dailymotion-downloader' />
}
