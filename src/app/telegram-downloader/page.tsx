import { PlatformLanding } from '@/components/PlatformLanding'
import { platformMetadata } from '@/lib/pageMetadata'

export const metadata = platformMetadata('telegram-downloader')

export default function Page() {
  return <PlatformLanding slug='telegram-downloader' />
}
