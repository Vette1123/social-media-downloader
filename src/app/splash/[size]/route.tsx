import { appIconContentType, renderSplash } from '@/lib/appIcon'
import { SPLASH_DEVICES, parseSplashSize, splashPixels } from '@/lib/splashDevices'

// iOS launch screens, one prerendered PNG per device (see
// src/lib/splashDevices.ts). force-static + generateStaticParams → the whole
// set is written into the export at build time and served from the edge cache;
// nothing here runs in production.
export const dynamic = 'force-static'
export const dynamicParams = false
export const contentType = appIconContentType

export function generateStaticParams() {
  return SPLASH_DEVICES.map((device) => {
    const { width, height } = splashPixels(device)
    return { size: `${width}x${height}` }
  })
}

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params
  const dimensions = parseSplashSize(size)
  // Unreachable in the export — `dynamicParams = false` means only the sizes
  // above are ever generated — but the handler still has to be total.
  if (!dimensions) return new Response('Not found', { status: 404 })
  return renderSplash(dimensions.width, dimensions.height)
}
