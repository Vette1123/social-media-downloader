import type { Metadata } from 'next'
import { AccountPage } from '@/components/InfoPages'
import { contentFor } from '@/lib/localeContent'
import { toRouteLocale } from '@/lib/routeLocale'

interface Props {
  params: Promise<{ lang: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = toRouteLocale((await params).lang)
  return {
    title: contentFor(locale).copy.legal.account.metaTitle,
    alternates: { canonical: `/${locale}/account` },
    robots: { index: false },
  }
}

export default async function Page({ params }: Props) {
  return <AccountPage locale={toRouteLocale((await params).lang)} />
}
