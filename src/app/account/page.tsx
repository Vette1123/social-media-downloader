import type { Metadata } from 'next'
import { AccountPage } from '@/components/InfoPages'
import { contentFor } from '@/lib/localeContent'

export const metadata: Metadata = {
  title: contentFor('en').copy.legal.account.metaTitle,
  alternates: { canonical: '/account' },
  robots: { index: false },
}

export default function Page() {
  return <AccountPage />
}
