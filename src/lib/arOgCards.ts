import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { homeOgCopy, platformOgCopy } from '@/lib/ogCopy'
import type { PlatformSlug } from '@/lib/platformSlugs'

/**
 * The Arabic share cards, drawn by Chrome (`pnpm og:ar`) and committed as
 * `src/og/ar/<name>.png`. Satori mis-orders right-to-left words, so Arabic is
 * the one language its image routes do not render at build.
 *
 * `name` is `home` or a platform slug.
 */
export type ArOgCardName = 'home' | PlatformSlug

/** A hash of the words on one Arabic card; the manifest pins it per PNG. */
export function arOgCopyHash(name: ArOgCardName): string {
  const copy = name === 'home' ? homeOgCopy('ar') : platformOgCopy('ar', name)
  return createHash('sha256').update(JSON.stringify(copy)).digest('hex').slice(0, 16)
}

export const arOgCardPath = (name: ArOgCardName) =>
  join(process.cwd(), 'src', 'og', 'ar', `${name}.png`)

/** The committed card as the image route's response. Build time only (force-static). */
export async function arOgCardResponse(name: ArOgCardName): Promise<Response> {
  const png = await readFile(arOgCardPath(name))
  return new Response(new Uint8Array(png), { headers: { 'content-type': 'image/png' } })
}
