import { HomeLanding } from '@/components/HomeLanding'
import { homeMetadata } from '@/lib/pageMetadata'
import { toRouteLocale } from '@/lib/routeLocale'

interface Props {
  params: Promise<{ lang: string }>
}

export async function generateMetadata({ params }: Props) {
  return homeMetadata(toRouteLocale((await params).lang))
}

export default async function Page({ params }: Props) {
  return <HomeLanding locale={toRouteLocale((await params).lang)} />
}
