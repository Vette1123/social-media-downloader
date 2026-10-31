import { TermsPage } from '@/components/InfoPages'
import { infoMetadata } from '@/lib/pageMetadata'
import { toRouteLocale } from '@/lib/routeLocale'

interface Props {
  params: Promise<{ lang: string }>
}

export async function generateMetadata({ params }: Props) {
  return infoMetadata('terms', toRouteLocale((await params).lang))
}

export default async function Page({ params }: Props) {
  return <TermsPage locale={toRouteLocale((await params).lang)} />
}
