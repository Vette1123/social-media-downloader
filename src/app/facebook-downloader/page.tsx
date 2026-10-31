import { PlatformLanding } from '@/components/PlatformLanding'
import { platformMetadata } from '@/lib/pageMetadata'

export const metadata = platformMetadata('facebook-downloader')

export default function Page() {
  return <PlatformLanding slug='facebook-downloader' />
}
