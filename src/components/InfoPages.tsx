import Link from '@/components/IntentLink'
import { AccountPanel } from '@/components/AccountPanel'
import { Rich } from '@/components/Rich'
import { SiteFooter } from '@/components/SiteFooter'
import { Surface } from '@/components/Surface'
import { CheckIcon, MailIcon } from '@/components/icons'
import { siteConfig } from '@/config/site'
import { proMailto, SUPPORT_PRICES } from '@/config/support'
import { fill, type Locale } from '@/lib/i18n'
import { contentFor } from '@/lib/localeContent'
import { localePath } from '@/lib/localeRoutes'
import type { ReactNode } from 'react'

const PRIVACY_UPDATED = '2026-10-31'
const TERMS_UPDATED = '2026-10-31'

const LINK = 'text-cyan-300 underline underline-offset-2 hover:text-cyan-200'

const EmailLink = ({ subject }: { subject?: string }) => (
  <a
    className={LINK}
    href={`mailto:${siteConfig.supportEmail}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`}
  >
    {siteConfig.supportEmail}
  </a>
)

const AuthorLink = () => (
  <a className={LINK} href={siteConfig.author.url}>
    {siteConfig.author.name}
  </a>
)

function formatDate(iso: string, locale: Locale): string {
  const tag = locale === 'en' ? 'en-GB' : locale
  return new Intl.DateTimeFormat(tag, {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(iso))
}

function Shell({
  locale,
  path,
  children,
}: {
  locale: Locale
  path: string
  children: ReactNode
}) {
  return (
    <div className='app-bg relative min-h-[100dvh] overflow-clip'>
      <div className='relative z-10 mx-auto max-w-3xl px-4 py-10 sm:py-16'>
        <main>{children}</main>
        <SiteFooter locale={locale} path={path} />
      </div>
    </div>
  )
}

function BackLink({ locale, label }: { locale: Locale; label: string }) {
  return (
    <Link
      href={localePath(locale, '/')}
      className='mt-10 inline-block text-sm text-cyan-300 hover:text-cyan-200'
    >
      {label}
    </Link>
  )
}

function LegalDocument({
  locale,
  path,
  updated,
  doc,
  parts,
}: {
  locale: Locale
  path: string
  updated: string
  doc: {
    title: string
    sections: Array<{ heading: string; paragraphs: string[] }>
  }
  parts: Record<string, ReactNode>
}) {
  const { shared } = contentFor(locale).copy.legal
  return (
    <Shell locale={locale} path={path}>
      <h1 className='text-3xl font-bold tracking-tight text-white sm:text-4xl'>
        {doc.title}
      </h1>
      <p className='mt-2 text-sm text-white/50'>
        {fill(shared.lastUpdated, { date: formatDate(updated, locale) })}
      </p>
      {locale !== 'en' && (
        <p className='mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/70'>
          <Rich
            text={shared.translationNote}
            parts={{
              english: (
                <Link href={path} className={LINK}>
                  {shared.englishVersion}
                </Link>
              ),
            }}
          />
        </p>
      )}

      <div className='mt-8 space-y-6 text-sm leading-relaxed text-white/70 md:text-base'>
        {doc.sections.map((section) => (
          <section key={section.heading}>
            <h2 className='mb-2 text-lg font-semibold text-white'>
              {section.heading}
            </h2>
            {section.paragraphs.map((paragraph, i) => (
              <p key={paragraph} className={i > 0 ? 'mt-2' : undefined}>
                <Rich text={paragraph} parts={parts} />
              </p>
            ))}
          </section>
        ))}
      </div>

      <BackLink locale={locale} label={shared.backArrow} />
    </Shell>
  )
}

export function PrivacyPage({ locale = 'en' }: { locale?: Locale }) {
  const { privacy } = contentFor(locale).copy.legal
  const account = (
    <Link href={localePath(locale, '/account')} className={LINK}>
      /account
    </Link>
  )
  return (
    <LegalDocument
      locale={locale}
      path='/privacy'
      updated={PRIVACY_UPDATED}
      doc={privacy}
      parts={{ account, email: <EmailLink />, author: <AuthorLink /> }}
    />
  )
}

export function TermsPage({ locale = 'en' }: { locale?: Locale }) {
  const { terms } = contentFor(locale).copy.legal
  return (
    <LegalDocument
      locale={locale}
      path='/terms'
      updated={TERMS_UPDATED}
      doc={terms}
      parts={{
        site: siteConfig.name,
        email: <EmailLink />,
        author: <AuthorLink />,
        notAffiliated: (
          <strong className='text-white/90'>{terms.notAffiliated}</strong>
        ),
      }}
    />
  )
}

export function AccountPage({ locale = 'en' }: { locale?: Locale }) {
  const { account, shared } = contentFor(locale).copy.legal
  return (
    <Shell locale={locale} path='/account'>
      <div className='text-center'>
        <span className='btn-grad inline-flex rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase'>
          {account.badge}
        </span>
        <h1 className='mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl'>
          {account.h1Lead} <span className='text-grad'>{account.h1Accent}</span>
        </h1>
        <p className='mx-auto mt-3 max-w-xl text-sm text-white/70 md:text-base'>
          {account.intro}
        </p>
      </div>

      {/* The prerender paints AccountPanel's skeleton, and hydration swaps it for
          a card that can be far shorter. Holding the skeleton's 480px means the
          swap moves nothing below it. */}
      <div className='mt-8 min-h-120'>
        <AccountPanel />
      </div>

      <BackLink locale={locale} label={shared.back} />
    </Shell>
  )
}

/**
 * The page that used to sell a subscription.
 *
 * It is a donation page now. Two merchants of record refused to process
 * payments for a third-party downloader, the second after every fixable item on
 * their review checklist had been fixed, so there is nothing to buy here and
 * nothing that renews.
 *
 * The extras are still real, and they are still the same four: properties of
 * this site, none of which widen what a link can reach. Since the payment
 * provider suspended the account (2026-11-06) support is arranged by email and
 * switched on by hand (`pnpm pro`) — which changes who runs the payment, not
 * what the money is. There is still no merchant of record here, no entitlement
 * to enforce and no refund policy, because a donation with a thank-you attached
 * is not a sale.
 *
 * What this page must never do is imply the tip buys reach. That claim is what
 * every acceptable-use policy in this space prohibits, and it is what closed
 * the store.
 */
export function ProPage({ locale = 'en' }: { locale?: Locale }) {
  const { copy } = contentFor(locale)
  const { pro, shared } = copy.legal
  return (
    <Shell locale={locale} path='/pro'>
      <div className='text-center'>
        <span className='btn-grad inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase'>
          <MailIcon className='h-3.5 w-3.5' />
          {pro.badge}
        </span>
        <h1 className='mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl'>
          {pro.h1Lead} <span className='text-grad'>{pro.h1Accent}</span>
        </h1>
        <p className='mx-auto mt-3 max-w-xl text-sm text-white/70 md:text-base'>
          {pro.intro}
        </p>
      </div>

      <Surface glow radius='3xl' className='mt-8 p-5 shadow-2xl sm:p-8'>
        <div className='grid gap-3 sm:grid-cols-2'>
          <a
            href={proMailto('Monthly or yearly')}
            data-pro-cta='pro_membership'
            className='btn-grad btn-press flex flex-col items-center gap-0.5 rounded-xl px-6 py-3.5'
          >
            <span className='text-sm font-semibold sm:text-base'>
              {pro.membership}
            </span>
            <span className='text-xs font-medium opacity-80'>
              {fill(pro.membershipPrice, {
                monthly: SUPPORT_PRICES.monthly,
                yearly: SUPPORT_PRICES.yearly,
              })}
            </span>
          </a>
          <a
            href={proMailto('Lifetime')}
            data-pro-cta='pro_lifetime'
            className='btn-press flex flex-col items-center gap-0.5 rounded-xl border border-white/15 bg-white/5 px-6 py-3.5 transition-colors hover:bg-white/10'
          >
            <span className='text-sm font-semibold text-white sm:text-base'>
              {pro.lifetime}
            </span>
            <span className='text-xs font-medium text-white/60'>
              {fill(pro.lifetimePrice, { lifetime: SUPPORT_PRICES.lifetime })}
            </span>
          </a>
        </div>

        <p className='mt-4 text-center text-sm text-white/60'>{pro.howItSwitches}</p>

        <div className='mt-8 border-t border-white/10 pt-6'>
          <h2 className='text-lg font-semibold text-white'>{pro.extrasTitle}</h2>
          <p className='mt-1 text-sm text-white/60'>
            {pro.levels}
          </p>
          <p className='mt-3 text-sm text-white/60'>
            <Rich
              text={pro.oneOff}
              parts={{
                email: <EmailLink subject='Supporter — switch on the extras' />,
              }}
            />
          </p>

          <ul className='mt-5 grid gap-3 sm:grid-cols-2'>
            {copy.support.benefits.map((benefit) => (
              <li
                key={benefit.title}
                className='rounded-xl border border-white/[0.08] bg-white/[0.03] p-4'
              >
                <div className='flex items-start gap-2.5'>
                  <CheckIcon className='mt-0.5 h-4 w-4 shrink-0 text-cyan-300' aria-hidden />
                  <div>
                    <p className='text-sm font-semibold text-white'>{benefit.title}</p>
                    <p className='mt-1 text-sm leading-relaxed text-white/60'>{benefit.body}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Not in PRO_BENEFITS on purpose: that list is what the *site*
              switches on for an entitled account, and this is a promise from
              a person. Keeping it out of the array is what stops it from
              turning up in the nudges, where an anonymous visitor would read
              it as a feature they are being denied. */}
          <p className='mt-5 rounded-xl border border-cyan-300/25 bg-cyan-400/5 p-4 text-sm text-white/75'>
            <strong className='font-semibold text-white'>{pro.directTitle}</strong>{' '}
            {pro.directBody}
          </p>
        </div>

        <p className='mt-6 text-sm text-white/60'>{pro.closing}</p>
      </Surface>

      <p className='mt-6 text-center text-xs text-white/50'>
        <Rich
          text={pro.tip}
          parts={{ email: <EmailLink />, author: <AuthorLink /> }}
        />
      </p>

      <BackLink locale={locale} label={shared.back} />
    </Shell>
  )
}
