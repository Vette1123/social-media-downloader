import type { Metadata } from 'next'
import { AccountPage } from '@/components/InfoPages'
import { accountMetadata } from '@/lib/pageMetadata'
import { toRouteLocale } from '@/lib/routeLocale'

interface Props {
  params: Promise<{ lang: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return accountMetadata(toRouteLocale((await params).lang))
}

export default async function Page({ params }: Props) {
  return <AccountPage locale={toRouteLocale((await params).lang)} />
}
