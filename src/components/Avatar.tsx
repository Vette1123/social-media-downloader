'use client'

/**
 * The visitor's Google avatar, with a monogram fallback.
 *
 * Shared by the top-right control and the account page. Google's avatar host
 * answers 403 for some referrers and its URLs go stale when someone changes
 * their photo, so a broken image here is normal rather than exceptional:
 * `onError` swaps in the monogram instead of leaving the browser's torn-image
 * glyph on the page.
 */

import { useState } from 'react'

export interface AvatarIdentity {
  name: string | null
  email: string | null
  picture: string | null
}

export function monogram(identity: AvatarIdentity | null): string {
  const source = identity?.name?.trim() || identity?.email?.trim() || ''
  return (source[0] ?? 'A').toUpperCase()
}

export function Avatar({
  identity,
  size,
  className = '',
}: {
  identity: AvatarIdentity | null
  /** Rendered pixel size. Also the intrinsic width/height, so the box is
   *  reserved before the image lands and the avatar cannot shift the layout. */
  size: number
  className?: string
}) {
  const [broken, setBroken] = useState(false)
  const picture = identity?.picture
  const box = { width: size, height: size }

  if (!picture || broken) {
    return (
      <span
        style={{ ...box, fontSize: Math.round(size * 0.4) }}
        className={`grad-fill flex shrink-0 items-center justify-center rounded-full font-bold ${className}`}
      >
        {monogram(identity)}
      </span>
    )
  }

  return (
    // A plain <img>, not next/image: a small remote avatar on a static export
    // would need remotePatterns and an optimizer that does not exist here.
    <img
      src={picture}
      alt=''
      width={size}
      height={size}
      style={box}
      loading='lazy'
      decoding='async'
      // Google's CDN rejects requests that carry our origin as the referrer.
      referrerPolicy='no-referrer'
      onError={() => setBroken(true)}
      className={`shrink-0 rounded-full object-cover ${className}`}
    />
  )
}
