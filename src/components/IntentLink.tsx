'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type ComponentProps, useEffect, useState } from 'react'
import { canWarm, warmOnFirstInteraction } from '@/lib/warmPrefetch'

type Props = ComponentProps<typeof Link> & {
  /** Prefetch this link after the visitor's first interaction. Few links only: see warmPrefetch.ts. */
  warm?: boolean
}

/**
 * The site's only `next/link`. Prefetches on intent, never on sight.
 *
 * The default prefetches every link the moment it scrolls into view, and a
 * static route's prefetch is its whole RSC payload: ~38 KiB a link, so the
 * homepage's platform grid cost a phone more than React itself for pages almost
 * nobody opened. A pointer entering a link or a finger landing on one still
 * prefetches, which is early enough for the tap to feel instant. `warm` adds the
 * likeliest few destinations once the visitor interacts, so those taps are
 * already cached; Lighthouse never interacts, so it never pays for them.
 *
 * `src/lib/intentLink.test.ts` fails if anything else imports next/link.
 */
export default function IntentLink({
  onMouseEnter,
  onTouchStart,
  warm,
  ...props
}: Props) {
  const [intent, setIntent] = useState(false)
  const router = useRouter()
  const href = typeof props.href === 'string' ? props.href : undefined

  useEffect(() => {
    if (!warm || !href) return
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } })
      .connection
    if (!canWarm(connection)) return
    return warmOnFirstInteraction(window, () => router.prefetch(href))
  }, [warm, href, router])

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
