import type { Metadata } from 'next'
import { HomeLanding } from '@/components/HomeLanding'
import { languageAlternates } from '@/lib/pageMetadata'

export const metadata: Metadata = {
  alternates: { canonical: '/', languages: languageAlternates('/') },
}

export default function Home() {
  return <HomeLanding />
}
