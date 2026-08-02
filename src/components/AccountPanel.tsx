'use client'

/**
 * The account page's content: plan, preferences, and account actions.
 *
 * Three fixed states drive the top of this file:
 *  - `signedIn === undefined` (no refresh has settled yet) renders a
 *    fixed-height skeleton, never the signed-out prompt — the latter would
 *    flash for every signed-in visitor on a cold load.
 *  - `signedIn === false` renders the sign-in prompt.
 *  - `signedIn === true` renders the three sections below.
 */

import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Surface } from '@/components/Surface'
import {
  type PlanState,
  refreshAccount,
  signInHref,
  signOut,
  useAccount,
} from '@/lib/account'
import {
  type Format,
  type Quality,
  persistPrefs,
  setFormat,
  setQuality,
  usePrefs,
} from '@/lib/prefs'
import {
  PRO_CHECKOUT_ANNUAL,
  PRO_CHECKOUT_MONTHLY,
  PRO_PRICE_ANNUAL,
  PRO_PRICE_MONTHLY,
  checkoutHref,
  isProCheckoutConfigured,
} from '@/config/pro'
import { PAST_DUE_GRACE_MS } from '@/lib/billing/entitlement'
import { formatDate, nowMs } from '@/lib/clientEnv'
import { siteConfig } from '@/config/site'

/**
 * Both checkout URLs come from the same pending Lemon Squeezy store, so one
 * flag gates every checkout link on this page — see ProCtaPanel.
 */
const CHECKOUT_READY =
  isProCheckoutConfigured(PRO_CHECKOUT_ANNUAL) && isProCheckoutConfigured(PRO_CHECKOUT_MONTHLY)

const CHECKOUT_POLL_INTERVAL_MS = 2_000
const CHECKOUT_POLL_TIMEOUT_MS = 30_000

const ACTION_BUTTON_CLASS =
  'btn-grad inline-flex rounded-xl px-5 py-2.5 text-sm font-semibold transition-transform duration-200 hover:-translate-y-0.5 active:scale-95'
const DISABLED_BUTTON_CLASS =
  'inline-flex cursor-not-allowed rounded-xl bg-white/[0.06] px-5 py-2.5 text-sm font-semibold text-white/40 ring-1 ring-white/10'
const SECONDARY_BUTTON_CLASS =
  'inline-flex rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-white/70 transition-colors hover:border-white/30 hover:text-white'
const TOGGLE_GROUP_CLASS = 'inline-flex rounded-full border border-white/10 bg-white/[0.03] p-0.5'

function toggleButtonClass(active: boolean): string {
  return `rounded-full px-3 py-1 text-xs font-medium transition-colors ${
    active ? 'bg-cyan-400/90 text-[#04171b]' : 'text-white/55 hover:text-white'
  }`
}

type PlanBucket = 'free' | 'active-monthly' | 'active-annual' | 'cancelled' | 'past-due' | 'ended'

/**
 * One bucket per row of the brief's plan table. A `switch` on `plan.status`,
 * not chained ternaries — an unrecognised status falls back to `free` rather
 * than matching some broader condition by accident, the same fail-closed
 * shape as `isProAt`.
 */
function classifyPlan(plan: PlanState | null): PlanBucket {
  switch (plan?.status ?? null) {
    case null:
      return 'free'
    case 'active':
    case 'on_trial':
      return plan?.variant === 'annual' ? 'active-annual' : 'active-monthly'
    case 'cancelled':
      return 'cancelled'
    case 'past_due':
      return 'past-due'
    case 'paused':
    case 'unpaid':
    case 'expired':
      return 'ended'
    default:
      return 'free'
  }
}

interface PlanCopy {
  lede: string
  note?: ReactNode
}

function planCopy(bucket: PlanBucket, plan: PlanState | null): PlanCopy {
  switch (bucket) {
    case 'free':
      return { lede: "You're on the free plan." }
    case 'active-monthly':
      return {
        lede: `Pro · ${PRO_PRICE_MONTHLY}/month · renews ${
          plan?.renewsAt ? formatDate(plan.renewsAt) : 'soon'
        }`,
      }
    case 'active-annual':
      return {
        lede: `Pro · ${PRO_PRICE_ANNUAL}/year · renews ${
          plan?.renewsAt ? formatDate(plan.renewsAt) : 'soon'
        }`,
        note: (
          <>
            Annual includes a call with the developer.{' '}
            <a
              href={`mailto:${siteConfig.author.email}?subject=${encodeURIComponent('Book a call — Pro annual')}`}
              className='text-cyan-300 hover:text-cyan-200'
            >
              Book one
            </a>
            .
          </>
        ),
      }
    case 'cancelled':
      return {
        lede: `Pro until ${
          plan?.endsAt ? formatDate(plan.endsAt) : 'the end of the period'
        }. Won't renew after that.`,
      }
    case 'past-due': {
      const endsAt =
        plan?.pastDueSince !== null && plan?.pastDueSince !== undefined
          ? plan.pastDueSince + PAST_DUE_GRACE_MS
          : null
      return {
        lede: `We couldn't take payment. Pro stays on until ${
          endsAt ? formatDate(endsAt) : 'the grace period ends'
        }.`,
      }
    }
    case 'ended':
      return { lede: 'Your subscription ended.' }
  }
}

/**
 * Attach the buyer to the checkout so the webhook can find them. `AccountState`
 * never exposes a user id (only email), and `checkoutHref`'s own contract is
 * that the webhook falls back to matching on email when the id is absent — so
 * an empty string here is the documented, correct value, not a workaround.
 */
function checkoutLink(base: string, email: string): string {
  return checkoutHref(base, '', email)
}

function checkoutBaseFor(variant: string | null | undefined): string {
  return variant === 'annual' ? PRO_CHECKOUT_ANNUAL : PRO_CHECKOUT_MONTHLY
}

function ComingSoonButton() {
  return (
    <button
      type='button'
      disabled
      title='Checkout is not set up yet'
      className={DISABLED_BUTTON_CLASS}
    >
      Checkout coming soon
    </button>
  )
}

function PlanPicker({ email }: { email: string | null }) {
  if (!CHECKOUT_READY || !email) return <ComingSoonButton />

  return (
    <div className='grid gap-3 sm:grid-cols-2'>
      <Surface elevation='raised' className='relative p-4 text-center'>
        <span className='btn-grad absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase'>
          Best value
        </span>
        <p className='mt-2 text-2xl font-extrabold text-white'>
          {PRO_PRICE_ANNUAL}
          <span className='text-sm font-medium text-white/50'>/year</span>
        </p>
        <a href={checkoutLink(PRO_CHECKOUT_ANNUAL, email)} className={`${ACTION_BUTTON_CLASS} mt-3`}>
          Get annual
        </a>
      </Surface>
      <Surface elevation='raised' className='p-4 text-center'>
        <p className='mt-2 text-2xl font-extrabold text-white'>
          {PRO_PRICE_MONTHLY}
          <span className='text-sm font-medium text-white/50'>/month</span>
        </p>
        <a href={checkoutLink(PRO_CHECKOUT_MONTHLY, email)} className={`${SECONDARY_BUTTON_CLASS} mt-3`}>
          Get monthly
        </a>
      </Surface>
    </div>
  )
}

function PlanAction({
  bucket,
  plan,
  email,
}: {
  bucket: PlanBucket
  plan: PlanState | null
  email: string | null
}) {
  switch (bucket) {
    case 'free':
      return <PlanPicker email={email} />
    case 'active-monthly':
    case 'active-annual':
      return (
        <a href='/api/billing/portal' className={SECONDARY_BUTTON_CLASS}>
          Manage billing
        </a>
      )
    case 'past-due':
      return (
        <a href='/api/billing/portal' className={SECONDARY_BUTTON_CLASS}>
          Update payment method
        </a>
      )
    case 'cancelled':
    case 'ended': {
      if (!CHECKOUT_READY || !email) return <ComingSoonButton />
      const label = bucket === 'cancelled' ? 'Resubscribe' : 'Subscribe again'
      const href = checkoutLink(checkoutBaseFor(plan?.variant), email)
      return (
        <a href={href} className={ACTION_BUTTON_CLASS}>
          {label}
        </a>
      )
    }
  }
}

function PlanSection({ plan, email }: { plan: PlanState | null; email: string | null }) {
  const bucket = classifyPlan(plan)
  const copy = planCopy(bucket, plan)

  return (
    <Surface glow radius='3xl' className='animate-card-enter p-5 shadow-2xl sm:p-6'>
      <h2 className='text-lg font-semibold text-white'>Plan</h2>
      <p className='mt-2 text-sm text-white/70'>{copy.lede}</p>
      {copy.note && <p className='mt-1 text-xs text-white/50'>{copy.note}</p>}
      <div className='mt-4'>
        <PlanAction bucket={bucket} plan={plan} email={email} />
      </div>
    </Surface>
  )
}

function PreferencesSection() {
  const { quality, format } = usePrefs()

  function chooseFormat(next: Format): void {
    setFormat(next)
    void persistPrefs({ quality, format: next })
  }

  function chooseQuality(next: Quality): void {
    setQuality(next)
    void persistPrefs({ quality: next, format })
  }

  return (
    <Surface radius='3xl' className='animate-card-enter p-5 sm:p-6'>
      <h2 className='text-lg font-semibold text-white'>Preferences</h2>
      <div className='mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs'>
        <div className='flex items-center gap-2'>
          <span className='text-white/40'>Format</span>
          <div role='group' aria-label='Download format' className={TOGGLE_GROUP_CLASS}>
            {(['video', 'audio'] as const).map((f) => (
              <button
                key={f}
                type='button'
                onClick={() => chooseFormat(f)}
                aria-pressed={format === f}
                className={toggleButtonClass(format === f)}
              >
                {f === 'video' ? 'Video' : 'Audio (MP3)'}
              </button>
            ))}
          </div>
        </div>

        {format === 'video' && (
          <div className='flex items-center gap-2'>
            <span className='text-white/40'>Quality</span>
            <div role='group' aria-label='Preferred video quality' className={TOGGLE_GROUP_CLASS}>
              {(['hd', 'sd'] as const).map((q) => (
                <button
                  key={q}
                  type='button'
                  onClick={() => chooseQuality(q)}
                  aria-pressed={quality === q}
                  className={toggleButtonClass(quality === q)}
                >
                  {q === 'hd' ? 'HD' : 'Data saver'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Surface>
  )
}

function AccountSection({ email }: { email: string | null }) {
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function handleSignOutEverywhere(): void {
    if (!window.confirm('Sign out of every device that is currently signed in?')) return
    void signOut(true)
  }

  async function handleDelete(): Promise<void> {
    const confirmed = window.confirm(
      "Delete your account? This does not cancel a live subscription — cancel it from the billing portal first, or it will keep renewing after the account is gone.",
    )
    if (!confirmed) return

    setDeleting(true)
    setDeleteError(null)
    try {
      const response = await fetch('/api/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delete: true }),
      })
      if (!response.ok) throw new Error('delete failed')
      await signOut()
      window.location.href = '/'
    } catch {
      setDeleteError('Could not delete the account. Try again.')
      setDeleting(false)
    }
  }

  return (
    <Surface radius='3xl' className='animate-card-enter p-5 sm:p-6'>
      <h2 className='text-lg font-semibold text-white'>Account</h2>
      <p className='mt-2 text-sm text-white/70'>{email ?? 'Signed in'}</p>

      <div className='mt-4 flex flex-wrap gap-3'>
        <button type='button' onClick={() => void signOut()} className={SECONDARY_BUTTON_CLASS}>
          Sign out
        </button>
        <button type='button' onClick={handleSignOutEverywhere} className={SECONDARY_BUTTON_CLASS}>
          Sign out everywhere
        </button>
      </div>

      <div className='mt-6 border-t border-white/10 pt-4'>
        <p className='text-xs text-white/50'>
          Deleting your account does not cancel a live subscription.{' '}
          <a href='/api/billing/portal' className='text-cyan-300 hover:text-cyan-200'>
            Cancel it from the billing portal
          </a>{' '}
          first if you have one.
        </p>
        <button
          type='button'
          onClick={() => void handleDelete()}
          disabled={deleting}
          className='mt-3 rounded-xl border border-red-400/30 px-4 py-2 text-sm font-semibold text-red-300 transition-colors hover:border-red-400/50 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50'
        >
          {deleting ? 'Deleting…' : 'Delete account'}
        </button>
        {deleteError && <p className='mt-2 text-xs text-red-300'>{deleteError}</p>}
      </div>
    </Surface>
  )
}

function Skeleton() {
  return (
    <div className='animate-pulse space-y-6'>
      <Surface radius='3xl' className='h-40 p-5 sm:p-6' />
      <Surface radius='3xl' className='h-28 p-5 sm:p-6' />
      <Surface radius='3xl' className='h-40 p-5 sm:p-6' />
    </div>
  )
}

function SignInPrompt() {
  return (
    <Surface glow radius='3xl' className='animate-card-enter p-6 text-center sm:p-8'>
      <p className='text-sm text-white/70'>Sign in to see your plan and manage your account.</p>
      <a href={signInHref('/account')} className={`${ACTION_BUTTON_CLASS} mt-4`}>
        Sign in with Google
      </a>
    </Surface>
  )
}

/**
 * Polls `refreshAccount({ force: true })` for up to 30s after a Lemon Squeezy
 * checkout redirects back here, since the webhook that flips `pro` to true can
 * lag the redirect by a few seconds. Reads the query string once on mount
 * rather than through `useSearchParams`, which would otherwise force this
 * static-export page into a Suspense boundary for a one-time check.
 */
function useCheckoutPolling(pro: boolean): 'idle' | 'polling' | 'timeout' {
  const [phase, setPhase] = useState<'idle' | 'polling' | 'timeout'>('idle')
  const proRef = useRef(pro)

  useEffect(() => {
    proRef.current = pro
  }, [pro])

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('checkout') !== 'success') return
    if (proRef.current) return

    setPhase('polling')
    const startedAt = nowMs()

    const tick = (): void => {
      if (proRef.current) {
        setPhase('idle')
        clearInterval(interval)
        return
      }
      if (nowMs() - startedAt >= CHECKOUT_POLL_TIMEOUT_MS) {
        setPhase('timeout')
        clearInterval(interval)
        return
      }
      void refreshAccount({ force: true })
    }

    tick()
    const interval = setInterval(tick, CHECKOUT_POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  return phase
}

export function AccountPanel() {
  const { signedIn, pro, email, plan } = useAccount()
  const checkoutPhase = useCheckoutPolling(pro)

  useEffect(() => {
    void refreshAccount()
  }, [])

  if (signedIn === undefined) return <Skeleton />
  if (signedIn === false) return <SignInPrompt />

  return (
    <div className='space-y-6'>
      {checkoutPhase !== 'idle' && (
        <Surface tone='accent' radius='2xl' className='p-4 text-sm text-white/80'>
          {checkoutPhase === 'polling'
            ? 'Setting up your subscription…'
            : 'Your payment went through. This can take a minute — refresh, or email us if it persists.'}
        </Surface>
      )}
      <PlanSection plan={plan} email={email} />
      <PreferencesSection />
      <AccountSection email={email} />
    </div>
  )
}
