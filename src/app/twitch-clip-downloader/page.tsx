import { PlatformLanding } from '@/components/PlatformLanding'
import { platformMetadata } from '@/lib/pageMetadata'

export const metadata = platformMetadata('twitch-clip-downloader')

export default function Page() {
  return <PlatformLanding slug='twitch-clip-downloader' />
}
