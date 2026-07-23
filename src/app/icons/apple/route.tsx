import { appIconContentType, renderAppIcon } from '@/lib/appIcon'

// Generated PNG app icon (see src/lib/appIcon.tsx). force-static → prerendered
// at build and served from the edge cache; referenced by manifest.json / layout.
export const dynamic = 'force-static'
export const contentType = appIconContentType

export function GET() {
  return renderAppIcon(180, false)
}
