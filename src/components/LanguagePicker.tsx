'use client'

import { usePathname } from 'next/navigation'
import { setLocale, useLocale, useT } from '@/lib/i18nStore'
import { LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n'
import { equivalentPath } from '@/lib/localeRoutes'

/**
 * The one language control, in the footer of every page: visible enough to
 * find, quiet enough to ignore. Where this page exists in the chosen language
 * it goes there, a full load so the HTML itself changes language; elsewhere the
 * store re-renders the translated surfaces and mirrors dir/lang onto <html>.
 */
export function LanguagePicker() {
  const t = useT()
  const value = useLocale()
  const pathname = usePathname()

  const choose = (next: Locale) => {
    setLocale(next)
    const target = equivalentPath(pathname, next)
    if (target && target !== pathname) window.location.assign(target)
  }

  return (
    <label className='inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap'>
      <span className='sr-only'>{t('langLabel')}</span>
      <span aria-hidden className='text-white/40'>
        🌐
      </span>
      <select
        value={value}
        onChange={(e) => choose(e.target.value as Locale)}
        className='cursor-pointer rounded-md border border-white/10 bg-transparent px-1.5 py-0.5 text-xs text-white/60 outline-none transition-colors hover:text-white [&>option]:bg-[#0b1220] [&>option]:text-white'
      >
        {LOCALES.map((locale) => (
          <option key={locale} value={locale}>
            {LOCALE_LABELS[locale]}
          </option>
        ))}
      </select>
    </label>
  )
}
