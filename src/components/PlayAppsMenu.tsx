'use client'

import { trackFeatureUsed } from '@/lib/analytics'
import { useEffect, useId, useRef, useState } from 'react'
import { useT } from '@/lib/i18nStore'
import { ChevronDownIcon } from '@/components/icons'
import { appIcon } from '@/components/AppIcon'
import { dKnown, useDeepWords } from '@/lib/i18nDeep'
import { Surface } from '@/components/Surface'
import { onStoreLinkClick, PLAY_APPS, storeHref, storesLabel } from '@/lib/apps'

/**
 * The footer's "Our apps" menu — the same popover the streaming site's header
 * uses, ported to this footer.
 *
 * It replaces three dot-separated links plus a trailing "apps made by us"
 * caption, which is what buckled the footer row onto three lines at desktop.
 * One trigger costs one slot and has room for each app's tagline, which the
 * inline list never had.
 *
 * Hand-rolled rather than a Radix popover on purpose: this is the only popover
 * on the site, and a positioning dependency would land in the Worker bundle,
 * which CI gates on startup bytes. Rows stay real anchors so middle-click and
 * "open in new tab" keep working; the click handler only prefers the native
 * Play Store app, exactly as the old links did.
 */
export function PlayAppsMenu() {
  const t = useT()
  useDeepWords()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      // Escape from inside the panel would otherwise drop focus on <body>.
      triggerRef.current?.focus()
    }
    // Tabbing past the last app closes the panel instead of leaving it hanging.
    const onFocusIn = (event: FocusEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className='relative'>
      <button
        type='button'
        onClick={() => {
          trackFeatureUsed('apps_menu', { action: open ? 'close' : 'open' })
          setOpen((wasOpen) => !wasOpen)
        }}
        ref={triggerRef}
        aria-expanded={open}
        aria-controls={panelId}
        className='inline-flex items-center gap-1.5 whitespace-nowrap text-white/70 transition-colors hover:text-white'
      >
        {/* The three real icons, overlapped, where a generic phone glyph was:
            the apps are recognisable before the menu opens. The ring in the
            footer's own colour cuts each icon from the one beneath it. */}
        <span className='flex -space-x-1.5' aria-hidden>
          {PLAY_APPS.map((app) => {
            const Icon = appIcon(app.slug)
            return <Icon key={app.slug} className='h-4 w-4 ring-2 ring-neutral-950' />
          })}
        </span>
        {t('ourApps')}
        <ChevronDownIcon
          className={`h-3.5 w-3.5 text-white/40 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* The positioning lives on this wrapper, not on the Surface: `.surface`
          is unlayered CSS carrying `position: relative`, so it beats an
          `absolute` utility passed in as a class and the panel would sit in
          flow, shoving the footer row apart.

          It is centred while the footer stacks centred on phones, and
          right-aligned from sm up, where the trigger is the last item on the
          right and a centred panel would hang past the edge. In Arabic the row
          mirrors, the trigger is last on the LEFT, and the panel anchors left. */}
      {open && (
        <div className='animate-section-in absolute bottom-full left-1/2 z-30 mb-2 w-72 -translate-x-1/2 sm:right-0 sm:left-auto sm:w-80 sm:translate-x-0 sm:rtl:right-auto sm:rtl:left-0'>
          {/* No "Our apps" heading inside: it repeated the trigger the reader
              just pressed. The menu still has the name, for screen readers. */}
          <Surface id={panelId} role='group' aria-label={t('ourApps')} radius='xl' elevation='raised' className='p-1.5 shadow-2xl'>
            {PLAY_APPS.map((app) => {
              const Icon = appIcon(app.slug)
              return (
              <a
                key={app.androidPackage}
                href={storeHref(app)}
                target='_blank'
                rel='noopener noreferrer'
                onClick={(e) => {
                  onStoreLinkClick(e, app)
                  setOpen(false)
                  trackFeatureUsed('app_store', { action: app.androidPackage })
                }}
                // .card-hover, not a translucent white film: rows in a panel are
                // exactly what that primitive is for, and hoverStyles.test.ts
                // fails the ad-hoc version.
                className='card-hover flex items-center gap-3 rounded-lg p-2 focus-visible:ring-1 focus-visible:ring-cyan-400/40 focus-visible:outline-none'
              >
                <Icon className='h-10 w-10' />
                <span className='min-w-0 flex-1'>
                  <span className='block text-sm leading-tight font-semibold text-white'>
                    {app.name}
                  </span>
                  <span className='mt-0.5 block text-xs leading-snug text-white/60'>
                    {dKnown(app.tagline)}
                  </span>
                  <span className='mt-0.5 block text-[11px] leading-snug text-white/50'>
                    {storesLabel(app)}
                  </span>
                </span>
              </a>
              )
            })}
          </Surface>
        </div>
      )}
    </div>
  )
}
