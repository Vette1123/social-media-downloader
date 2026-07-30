'use client'

import { useEffect, useState } from 'react'
import { CloseIcon, DownloadIcon, ExternalLinkIcon } from '@/components/icons'
import {
  INSTALL_DISMISS_KEY,
  useInstallOfferable,
  useIsIOSSafari,
} from '@/lib/clientEnv'

// Chrome fires this before showing its install UI; capturing it lets us trigger
// the native install prompt from our own button instead.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// A quiet, on-brand nudge to install the PWA. Installing is what registers the
// app as an Android Share Target, so a user can share a link straight from the
// TikTok/Instagram/YouTube app into this one — no browser, no copy-paste.
//
// Android/Chrome: capture beforeinstallprompt and drive a one-tap Install button.
// iOS Safari: no beforeinstallprompt and no share-target support, so we show the
// manual "Add to Home Screen" hint (the home-screen icon + one-tap Paste is the
// iOS flow). Hidden entirely once installed (standalone) or dismissed.
export function InstallPrompt() {
  // "Can we offer an install here at all" and "is this iOS Safari" are fixed
  // properties of the browser, read without an effect — see lib/clientEnv.
  const offerable = useInstallOfferable()
  const isIOS = useIsIOSSafari()
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [closed, setClosed] = useState(false)

  useEffect(() => {
    if (!offerable) return
    // Subscribing to an external system and calling setState from its callback
    // is the supported shape — unlike setting state in the effect body.
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setClosed(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [offerable])

  // iOS Safari never fires beforeinstallprompt, so the manual Add-to-Home-Screen
  // hint is the only offer available there. Everywhere else we stay silent until
  // Chrome hands us the event — showing an Install button that can't install is
  // worse than showing nothing.
  const haveSomethingToOffer = isIOS || deferred !== null
  if (!offerable || closed || !haveSomethingToOffer) return null

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    await deferred.userChoice
    setDeferred(null)
    setClosed(true)
  }

  const dismiss = () => {
    setClosed(true)
    try {
      window.localStorage.setItem(INSTALL_DISMISS_KEY, '1')
    } catch {
      // ignore — session-only dismissal is fine.
    }
  }

  return (
    <div className='animate-section-in relative mt-4 flex items-center gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06] p-3 pr-9'>
      <span className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#17171d] to-[#0a0a0c] ring-1 ring-cyan-400/40'>
        <DownloadIcon className='h-5 w-5 text-cyan-300' />
      </span>

      <div className='min-w-0 flex-1'>
        <p className='text-sm font-medium text-white'>Install the app</p>
        <p className='mt-0.5 text-xs text-white/60'>
          {isIOS
            ? 'Tap Share, then “Add to Home Screen”.'
            : 'Share videos straight from TikTok. No browser, no paste.'}
        </p>
      </div>

      {isIOS ? (
        <span className='flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1.5 text-xs font-medium text-white/70'>
          <ExternalLinkIcon className='h-3.5 w-3.5' />
          Share
        </span>
      ) : (
        <button
          type='button'
          onClick={install}
          className='btn-grad btn-press shrink-0 cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold'
        >
          Install
        </button>
      )}

      <button
        type='button'
        onClick={dismiss}
        aria-label='Dismiss install prompt'
        className='absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-md text-white/30 transition-colors hover:bg-white/10 hover:text-white/70'
      >
        <CloseIcon className='h-3.5 w-3.5' />
      </button>
    </div>
  )
}
