/**
 * iOS launch-screen targets.
 *
 * Safari picks a launch image by matching the media query *exactly* — device
 * width, device height and pixel ratio all have to agree. There is no
 * best-effort fallback: a device with no matching entry gets a blank screen
 * while the page loads. So this is a list of real devices, and adding a new
 * iPhone means adding a line here.
 *
 * Portrait only. A home-screen web app launches in the orientation the phone
 * is held in, but iPhones are held portrait to launch something far more often
 * than not, and doubling the list would double both the build's rasterising
 * work and the exported bytes for the rarer half.
 *
 * One module because two places need the same list and they must not drift:
 * `src/app/splash/[size]/route.tsx` renders the images, and the `appleWebApp`
 * metadata in `src/app/layout.tsx` writes the matching <link> tags.
 */

export interface SplashDevice {
  /** CSS pixels, as the media query reports them. */
  width: number
  height: number
  ratio: number
  /** Which hardware this covers. Only here so the list can be maintained. */
  label: string
}

export const SPLASH_DEVICES: SplashDevice[] = [
  { width: 320, height: 568, ratio: 2, label: 'iPhone SE (1st gen)' },
  { width: 375, height: 667, ratio: 2, label: 'iPhone SE (2nd/3rd gen), 8' },
  { width: 414, height: 736, ratio: 3, label: 'iPhone 8 Plus' },
  { width: 375, height: 812, ratio: 3, label: 'iPhone X, XS, 11 Pro, 12/13 mini' },
  { width: 414, height: 896, ratio: 2, label: 'iPhone XR, 11' },
  { width: 414, height: 896, ratio: 3, label: 'iPhone XS Max, 11 Pro Max' },
  { width: 390, height: 844, ratio: 3, label: 'iPhone 12, 13, 14' },
  { width: 428, height: 926, ratio: 3, label: 'iPhone 12/13 Pro Max, 14 Plus' },
  { width: 393, height: 852, ratio: 3, label: 'iPhone 14 Pro, 15, 15 Pro, 16' },
  { width: 430, height: 932, ratio: 3, label: 'iPhone 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus' },
  { width: 402, height: 874, ratio: 3, label: 'iPhone 16 Pro' },
  { width: 440, height: 956, ratio: 3, label: 'iPhone 16 Pro Max' },
  { width: 768, height: 1024, ratio: 2, label: 'iPad 9.7"' },
  { width: 810, height: 1080, ratio: 2, label: 'iPad 10.2"' },
  { width: 820, height: 1180, ratio: 2, label: 'iPad Air 10.9"' },
  { width: 834, height: 1112, ratio: 2, label: 'iPad Pro 10.5"' },
  { width: 834, height: 1194, ratio: 2, label: 'iPad Pro 11"' },
  { width: 1024, height: 1366, ratio: 2, label: 'iPad Pro 12.9"' },
]

/** Device pixels: what the PNG is actually rendered at. */
export function splashPixels(device: SplashDevice): { width: number; height: number } {
  return { width: device.width * device.ratio, height: device.height * device.ratio }
}

/** The route that serves this device's image, e.g. `/splash/1179x2556`. */
export function splashPath(device: SplashDevice): string {
  const { width, height } = splashPixels(device)
  return `/splash/${width}x${height}`
}

/** The `media` attribute Safari matches against. All three clauses required. */
export function splashMedia(device: SplashDevice): string {
  return (
    `(device-width: ${device.width}px) and (device-height: ${device.height}px) ` +
    `and (-webkit-device-pixel-ratio: ${device.ratio}) and (orientation: portrait)`
  )
}

/** `1179x2556` back to the two numbers, or null if the segment is not one of ours. */
export function parseSplashSize(size: string): { width: number; height: number } | null {
  const match = /^(\d{3,5})x(\d{3,5})$/.exec(size)
  if (!match) return null
  const width = Number(match[1])
  const height = Number(match[2])
  const known = SPLASH_DEVICES.some((device) => {
    const pixels = splashPixels(device)
    return pixels.width === width && pixels.height === height
  })
  return known ? { width, height } : null
}
