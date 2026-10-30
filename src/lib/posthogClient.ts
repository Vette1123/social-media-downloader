/**
 * Lazy access to the posthog-js singleton.
 *
 * posthog-js is the largest chunk this site would ship, and the mobile
 * Lighthouse score is a deliberate number. So the module is only ever imported
 * dynamically, well after the page has loaded. Call sites use `ph()`; a static
 * `import posthog from 'posthog-js'` anywhere would put it back on the critical
 * path. `import type` is fine, it is erased at build.
 */

import type { PostHog } from 'posthog-js'

// The dev server, `pnpm preview`, and a phone testing over the LAN.
const LOCAL_HOST =
  /^(localhost|127\.|0\.0\.0\.0|\[?::1\]?|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/

// Headless Chrome's default window. A real browser this exact INNER size is
// rare, because a 1280x720 display loses height to the tab strip.
const HEADLESS_VIEWPORT = { width: 1280, height: 720 }

/**
 * An anti-detect browser farm randomises the screen into shapes no desktop
 * monitor has. Measured on the sister project: desktop screens at height/width
 * 0.85-0.95 were 976 "people" and zero conversions. Real desktops sit at
 * 0.55-0.75; a 5:4 monitor is exactly 0.80 and a portrait one is above 1.
 */
export function isSquareScreenFleet({
  ua,
  screenWidth,
  screenHeight,
}: {
  ua: string
  screenWidth: number
  screenHeight: number
}): boolean {
  if (!/Windows NT|Macintosh|X11; Linux/.test(ua)) return false
  if (/Mobile|Android|iPhone|iPad/.test(ua)) return false
  if (!screenWidth || !screenHeight) return false
  const ratio = screenHeight / screenWidth
  return ratio >= 0.85 && ratio <= 0.95
}

/**
 * Desktop Chrome with no plug-ins AND a software renderer. Real desktop Chrome
 * always exposes its PDF viewers and names a real GPU; either alone is a
 * fingerprint rather than a rule, so both must agree.
 */
function looksHeadlessDesktop(): boolean {
  const ua = navigator.userAgent
  if (!ua.includes('Chrome/') || /Mobile|Android|iPhone|iPad/.test(ua)) return false
  if (navigator.plugins?.length !== 0) return false
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl')
  if (!gl) return true
  const info = gl.getExtension('WEBGL_debug_renderer_info')
  if (!info) return false
  const renderer = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) ?? '')
  return /swiftshader|llvmpipe|software/i.test(renderer)
}

function isAutomated(): boolean {
  try {
    if (navigator.webdriver) return true
    if (
      window.innerWidth === HEADLESS_VIEWPORT.width &&
      window.innerHeight === HEADLESS_VIEWPORT.height
    ) {
      return true
    }
    if (
      isSquareScreenFleet({
        ua: navigator.userAgent,
        screenWidth: screen.width,
        screenHeight: screen.height,
      })
    ) {
      return true
    }
    return looksHeadlessDesktop()
  } catch {
    return false
  }
}

let enabled: boolean | null = null

/**
 * Analytics is production-only and human-only, and this is the one place that
 * decides both. It lives in the gateway every call passes, so a new call site
 * cannot leak dev or bot data by omission. Cloudflare already counts bots
 * (`pnpm cf:health`); PostHog answers questions about people.
 */
export const analyticsEnabled = (): boolean => {
  if (typeof window === 'undefined') return false
  // Every `ph()` passes here, and the bot check can open a WebGL context.
  enabled ??=
    Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY) &&
    process.env.NODE_ENV === 'production' &&
    !LOCAL_HOST.test(window.location.hostname) &&
    !window.location.hostname.endsWith('.local') &&
    !isAutomated()
  return enabled
}

/** Past `load`, so the SDK competes with nothing the visitor is waiting for. */
export const BOOT_DELAY_MS = 4000

/**
 * Run `fn` once the page has finished loading, BOOT_DELAY_MS have passed and the
 * browser is idle. `requestIdleCallback` alone is not a delay: on a quiet page it
 * fires at once, which put the SDK 37 ms behind `load` on the live site.
 *
 * ponytail: a visitor who leaves inside this window sends nothing, not even a
 * pageview, so the shortest bounces are undercounted. Lower BOOT_DELAY_MS to
 * trade load headroom for those visits.
 */
export function afterPageSettles(fn: () => void): void {
  const wait = () => {
    setTimeout(() => {
      if ('requestIdleCallback' in window) window.requestIdleCallback(fn, { timeout: 2000 })
      else fn()
    }, BOOT_DELAY_MS)
  }
  if (document.readyState === 'complete') wait()
  else window.addEventListener('load', wait, { once: true })
}

let instance: PostHog | null = null
let loading: Promise<PostHog | null> | null = null
const queued: ((posthog: PostHog) => void)[] = []
let initialize: ((posthog: PostHog) => void) | null = null

/**
 * The provider's `posthog.init(...)`, run BEFORE anything queued is replayed.
 * The sister project replayed first, and every register() made during page load
 * landed on an uninitialised instance and was dropped, for 99% of people.
 */
export function setPostHogInitializer(fn: (posthog: PostHog) => void): void {
  initialize = fn
}

/** Fetch, init, then replay. The order is the point; see setPostHogInitializer. */
export function bootPostHog(
  posthog: PostHog,
  init: ((posthog: PostHog) => void) | null,
  pending: ((posthog: PostHog) => void)[],
): void {
  init?.(posthog)
  for (const fn of pending.splice(0)) fn(posthog)
}

/**
 * Fetch the module, init, then replay what `ph()` queued. Idempotent. Resolves
 * to null where analytics is off, so callers need no gate of their own.
 */
export function loadPostHog(): Promise<PostHog | null> {
  if (instance) return Promise.resolve(instance)
  if (!analyticsEnabled()) return Promise.resolve(null)
  loading ??= import('posthog-js').then((mod) => {
    const posthog = mod.default
    instance = posthog
    bootPostHog(posthog, initialize, queued)
    return posthog
  })
  return loading
}

/**
 * Run `fn` against the singleton: synchronously once loaded, queued before
 * that. Never triggers the import, because a capture on mount would pull the
 * chunk during hydration. Dropped where analytics is off, since nothing would
 * ever flush the queue.
 */
export function ph(fn: (posthog: PostHog) => void): void {
  if (instance) {
    fn(instance)
    return
  }
  if (!analyticsEnabled()) return
  queued.push(fn)
}
