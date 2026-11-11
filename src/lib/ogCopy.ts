import { siteConfig } from '@/config/site'
import type { Locale } from '@/lib/i18n'
import { platformFor, contentFor } from '@/lib/localeContent'
import type { PlatformSlug } from '@/lib/platforms'

export interface OgCopy {
  /** Small line beside the glyph, e.g. "TikTok downloader". */
  label: string
  free: string
  headline: string
  tagline: string
  chips: string[]
}

/**
 * The language a share card is drawn in. Arabic stays on the English card:
 * satori shapes the letters but mis-orders the words of a right-to-left line
 * (checked on a rendered card 2026-11-11), and a broken card is worse than a
 * foreign one. Upgrade path: drop this once satori lays out RTL runs.
 */
export function ogCardLocale(locale: Locale): Locale {
  return locale === 'ar' ? 'en' : locale
}

/** First string that is not blank, so a missing translation falls back to English. */
function pick(...candidates: Array<string | undefined>): string {
  return candidates.find((c) => c && c.trim()) ?? ''
}

/** The words on a platform's share card, in `locale`. Pure: no fonts, no images. */
export function platformOgCopy(locale: Locale, slug: PlatformSlug): OgCopy {
  const en = platformFor('en', slug)
  const local = platformFor(locale, slug)
  const en$ = contentFor('en').copy.chips
  const chips = contentFor(locale).copy.chips
  return {
    label: locale === 'en' ? `${en.name} downloader` : pick(local.brandLabel, `${en.name} downloader`),
    free: pick(chips?.free, en$.free),
    headline: pick(local.h1, en.h1),
    tagline: pick(local.tagline, en.tagline),
    chips: [
      pick(chips?.noLoginRequired, en$.noLoginRequired),
      pick(chips?.hd, en$.hd),
      pick(chips?.noLimits, en$.noLimits),
    ],
  }
}

/** The words on the home share card. English keeps its hand-written headline. */
export function homeOgCopy(locale: Locale): OgCopy {
  const en = contentFor('en').copy
  const copy = contentFor(locale).copy
  const lead = pick(copy.home.h1Lead, en.home.h1Lead)
  const accent = pick(copy.home.h1Accent, en.home.h1Accent)
  return {
    label: siteConfig.name,
    free: pick(copy.chips?.free, en.chips.free),
    headline: `${lead} ${accent}`,
    tagline: pick(copy.chips?.anyLink, en.chips.anyLink),
    chips: [
      pick(copy.chips?.noLoginRequired, en.chips.noLoginRequired),
      pick(copy.chips?.hd, en.chips.hd),
      pick(copy.chips?.noLimits, en.chips.noLimits),
    ],
  }
}

/** Long translated headlines must still fit two lines of the card. */
export function headlineSize(text: string, max = 72): number {
  if (text.length <= 28) return max
  if (text.length <= 48) return Math.round(max * 0.78)
  return Math.round(max * 0.62)
}
