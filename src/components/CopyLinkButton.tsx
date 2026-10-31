'use client'

import { useState } from 'react'
import { useT } from '@/lib/i18nStore'
import { trackShared } from '@/lib/analytics'

/**
 * Copy the original post link. The smallest possible "take it with you" —
 * pairs with Share where that exists, stands in for it where it doesn't.
 */
export function CopyLinkButton({ url }: { url: string }) {
  const t = useT()
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      trackShared({ surface: 'result', method: 'clipboard', outcome: 'done' })
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // clipboard permission denied — nothing useful to say; the URL is on screen.
      trackShared({ surface: 'result', method: 'clipboard', outcome: 'failed' })
    }
  }

  return (
    <button
      type='button'
      onClick={() => void handleCopy()}
      className='rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:text-white'
    >
      {copied ? t('copied') : t('copyLink')}
    </button>
  )
}
