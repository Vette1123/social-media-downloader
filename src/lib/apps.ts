// Our companion apps, published on Google Play.
// Shared metadata + a store-open helper reused across footers, nav, and CTAs.

export type PlayApp = {
  name: string
  /** One line under the name in the footer menu. Same copy the apps ship with. */
  tagline: string
  androidPackage: string
  playStoreUrl: string
}

const playApp = (
  name: string,
  tagline: string,
  androidPackage: string,
): PlayApp => ({
  name,
  tagline,
  androidPackage,
  playStoreUrl: `https://play.google.com/store/apps/details?id=${androidPackage}`,
})

export const PLAY_APPS: readonly PlayApp[] = [
  playApp(
    'Rafiq',
    'A private Islamic companion: prayer, Qur’an, adhkar, qibla',
    'com.mohamedgado.rafiq',
  ),
  playApp(
    'Masareef',
    'An offline-first, multi-currency spending tracker',
    'com.mohamedgado.masareef',
  ),
  playApp(
    'Nafis',
    'A local-price tracker for gold, currencies and more',
    'com.mohamedgado.nafis',
  ),
]

/**
 * Open an app's Play listing, mirroring the apps' own deep-link behaviour: try
 * the native Play Store app first, then fall back to the web listing.
 *
 * - Non-Android (desktop, iOS): `market://` can't be handled, so we open the
 *   web listing directly in a new tab. On Android the web URL itself hands off
 *   to the Play Store app when installed.
 * - Android: navigate to `market://` to launch the Play Store app. If nothing
 *   handles it (app missing) the page stays visible, so a short timeout falls
 *   back to the web listing. A successful hand-off hides the page, which
 *   cancels the fallback.
 */
export function openOnPlayStore(app: PlayApp): void {
  if (typeof window === 'undefined') return

  const isAndroid = /android/i.test(window.navigator.userAgent)
  if (!isAndroid) {
    window.open(app.playStoreUrl, '_blank', 'noopener,noreferrer')
    return
  }

  const fallback = window.setTimeout(() => {
    window.location.href = app.playStoreUrl
  }, 1200)

  const cancel = () => {
    window.clearTimeout(fallback)
    document.removeEventListener('visibilitychange', cancel)
  }
  document.addEventListener('visibilitychange', cancel)

  window.location.href = `market://details?id=${app.androidPackage}`
}
