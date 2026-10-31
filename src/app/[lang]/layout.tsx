import type { ReactNode } from 'react'
import { AccountControl } from '@/components/AccountControl'
import { HomeControl } from '@/components/HomeControl'
import { RouteDictionary } from '@/components/RouteLocale'
import { dictionaries } from '@/lib/i18nDictionaries'
import { ROUTE_LOCALES } from '@/lib/localeRoutes'
import { toRouteLocale } from '@/lib/routeLocale'

export const dynamicParams = false

export function generateStaticParams() {
  return ROUTE_LOCALES.map((lang) => ({ lang }))
}

export default async function LocaleLayout({
  params,
  children,
}: {
  params: Promise<{ lang: string }>
  children: ReactNode
}) {
  const locale = toRouteLocale((await params).lang)
  return (
    <RouteDictionary locale={locale} dictionary={dictionaries[locale]}>
      <HomeControl />
      <AccountControl />
      {children}
    </RouteDictionary>
  )
}
