import { PlatformLanding } from '@/components/PlatformLanding'
import { platformMetadata } from '@/lib/pageMetadata'

export const metadata = platformMetadata('snapchat-downloader')

export default function Page() {
  return <PlatformLanding slug='snapchat-downloader' />
}
