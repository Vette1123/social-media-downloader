'use client'

import Link from 'next/link'
import { type ComponentProps, useState } from 'react'

/**
 * The site's only `next/link`. Prefetches on intent, never on sight.
 *
 * The default prefetches every link the moment it scrolls into view, and a
 * static route's prefetch is its whole RSC payload: 13 KB a link, so the
 * homepage's platform grid cost a phone more than React itself for pages almost
 * nobody opened. A pointer entering a link or a finger landing on one still
 * prefetches, which is early enough for the tap to feel instant.
 *
 * `src/lib/intentLink.test.ts` fails if anything else imports next/link.
 */
export default function IntentLink({
  onMouseEnter,
  onTouchStart,
  ...props
}: ComponentProps<typeof Link>) {
  const [intent, setIntent] = useState(false)

  return (
    <Link
      {...props}
      prefetch={intent ? null : false}
      onMouseEnter={(event) => {
        setIntent(true)
        onMouseEnter?.(event)
      }}
      onTouchStart={(event) => {
        setIntent(true)
        onTouchStart?.(event)
      }}
    />
  )
}
