import { GitHubIcon, PortfolioIcon } from '@/components/icons'
import { LinkCard } from '@/components/LinkCard'
import { PlayAppPromoCards } from '@/components/PlayAppPromoCards'
import { siteConfig } from '@/config/site'
import type { Locale } from '@/lib/i18n'
import { contentFor } from '@/lib/localeContent'
import { INSTALL_SLOT_ID } from '@/lib/clientEnv'

/**
 * Hero row: who built this, plus our own apps. Rendered identically
 * on the homepage and every platform landing page — it lived in both files
 * before, which is how the two Play cards ended up clipped on phones in one
 * place and had to be fixed in two.
 */
export function DevAppLinks({ locale = 'en' }: { locale?: Locale }) {
  const devLinks = [
    {
      href: siteConfig.author.url,
      label: contentFor(locale).copy.footer.portfolio,
      Icon: PortfolioIcon,
    },
    { href: siteConfig.links.github, label: 'GitHub', Icon: GitHubIcon },
  ]
  return (
    <>
      <div className='mx-auto mt-6 flex max-w-md flex-wrap items-stretch justify-center gap-2 sm:max-w-none sm:gap-3'>
        {devLinks.map((link) => (
          <LinkCard key={link.label} {...link} />
        ))}
        <PlayAppPromoCards />
      </div>
      <div id={INSTALL_SLOT_ID} />
    </>
  )
}
