import { PlatformLanding } from '@/components/PlatformLanding'
import { platformMetadata } from '@/lib/pageMetadata'

export const metadata = platformMetadata('pinterest-downloader')

export default function Page() {
  return <PlatformLanding slug='pinterest-downloader' />
}
