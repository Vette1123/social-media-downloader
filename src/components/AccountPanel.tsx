'use client'

/**
 * The account page's content: plan, preferences, and account actions.
 *
 * Four fixed states drive the top of this file:
 *  - `signedIn === undefined` (no refresh has settled yet) renders a
 *    fixed-height skeleton, never the signed-out prompt — the latter would
 *    flash for every signed-in visitor on a cold load.
 *  - `signedIn === undefined` *and* `failed` renders a message and a retry.
 *    Without it, a 503 (the state of any deployment whose `DB` binding or
 *    `PRO_TOKEN_SECRET` is not set yet) pulses that skeleton forever.
 *  - `signedIn === false` renders the sign-in prompt.
 *  - `signedIn === true` renders the three sections below.
 */

import { type ReactNode, useEffect, useRef, useState } from 'react'
import { Surface } from '@/components/Surface'
import { Avatar, type AvatarIdentity } from '@/components/Avatar'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ChevronDownIcon } from '@/components/icons'
import {
  type PlanState,
  cachedProfile,
  cancelPlan,
  hasAccountHint,
  markSignedOut,
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
import { PAST_DUE_GRACE_MS, paidThrough } from '@/lib/billing/entitlement'
import { formatDate, nowMs, useHydrated, useOnPageVisible } from '@/lib/clientEnv'
import { siteConfig } from '@/config/site'

/**
 * Both checkout URLs come from the same Creem store, so one flag gates every
 * checkout link on this page — see ProCtaPanel.
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
/**
 * The lowest-emphasis button on the page, for actions that must be findable
 * without being invited: cancelling, and nothing else so far.
 *
 * Deliberately not `.btn-danger`. Red is for the irreversible — closing an
 * account — and cancelling is neither irreversible nor immediate: Pro runs to
 * the end of the period and resubscribing is one click. Painting it as a hazard
 * would misdescribe it and put a red button on the card of every paying
 * customer.
 */
const QUIET_BUTTON_CLASS =
  'inline-flex rounded-xl px-3 py-2 text-sm font-medium text-white/45 outline-none transition-colors hover:text-white/80 focus-visible:ring-2 focus-visible:ring-cyan-400/60 disabled:cursor-not-allowed disabled:opacity-60'

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
 *
 * `now` is taken as an argument rather than read inside, so that the same clock
 * decides "is this still Pro" here and in `isProAt` on the server. The two
 * cancelled statuses both land in `cancelled` while the paid period is running
 * and `ended` once it is not — `paidThrough` is imported rather than rewritten
 * so this screen cannot start disagreeing with entitlement about the same date.
 */
export function classifyPlan(plan: PlanState | null, now: number): PlanBucket {
  switch (plan?.status ?? null) {
    case null:
      return 'free'
    case 'active':
    case 'trialing':
      return plan?.variant === 'annual' ? 'active-annual' : 'active-monthly'
    // `scheduled_cancel` is Creem's API saying "stops at period end";
    // `canceled` is its portal saying "stopped", which for a subscriber with
    // months left on an annual plan is not what we sold them.
    case 'scheduled_cancel':
    case 'canceled':
      return paidThrough(plan?.endsAt ?? null, now) ? 'cancelled' : 'ended'
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

export function planCopy(bucket: PlanBucket, plan: PlanState | null): PlanCopy {
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
              href={`mailto:${siteConfig.supportEmail}?subject=${encodeURIComponent('Book a call — Pro annual')}`}
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
        // Said because it is the question someone has straight after
        // cancelling, and because the honest answer is reassuring: they are
        // cancelled, they keep what they paid for, and no further money moves.
        note: 'You keep Pro until then, and nothing further will be charged.',
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
      return {
        lede: "Your subscription has ended, so you're back on the free plan.",
        note: 'Nothing further will be charged.',
      }
  }
}

/**
 * Who to attach a checkout to.
 *
 * The id is the whole of it, and it is not optional: it is what the webhook
 * matches on, and a purchase made without one can end up matching no row at
 * all, unrepairably. Creem payment links take no email prefill, so the buyer
 * types their own address at checkout and it is never a binding we rely on.
 */
interface Buyer {
  userId: string
}

function buyerOf(userId: string | null): Buyer | null {
  if (!CHECKOUT_READY || !userId) return null
  return { userId }
}

function checkoutLink(base: string, buyer: Buyer): string {
  return checkoutHref(base, buyer.userId)
}

function checkoutBaseFor(variant: string | null | undefined): string {
  return variant === 'annual' ? PRO_CHECKOUT_ANNUAL : PRO_CHECKOUT_MONTHLY
}

/**
 * Shown only while the store's payment links are unset.
 *
 * Says what is actually happening rather than "coming soon": this is the last
 * step of a real purchase flow that a signed-in visitor has already walked, so
 * a bare disabled button reads as an abandoned product rather than a store
 * mid-verification.
 */
function CheckoutPendingButton() {
  return (
    <div className='flex flex-col items-center gap-2 text-center'>
      <button
        type='button'
        disabled
        title='Card payments are not switched on for this deployment yet'
        className={DISABLED_BUTTON_CLASS}
      >
        Card payments opening shortly
      </button>
      <p className='text-xs text-white/40'>
        Your account is ready — nothing to redo once payments are live.
      </p>
    </div>
  )
}

function PlanPicker({ buyer }: { buyer: Buyer | null }) {
  if (!buyer) return <CheckoutPendingButton />

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
        <a href={checkoutLink(PRO_CHECKOUT_ANNUAL, buyer)} className={`${ACTION_BUTTON_CLASS} mt-3`}>
          Get annual
        </a>
      </Surface>
      <Surface elevation='raised' className='p-4 text-center'>
        <p className='mt-2 text-2xl font-extrabold text-white'>
          {PRO_PRICE_MONTHLY}
          <span className='text-sm font-medium text-white/50'>/month</span>
        </p>
        <a href={checkoutLink(PRO_CHECKOUT_MONTHLY, buyer)} className={`${SECONDARY_BUTTON_CLASS} mt-3`}>
          Get monthly
        </a>
      </Surface>
    </div>
  )
}

/**
 * Cancelling, with the confirmation step and the two states it can fail into.
 *
 * The confirmation is the same `ConfirmDialog` that guards closing an account,
 * because a second vocabulary for "are you sure" on one screen is how a UI
 * starts to feel assembled rather than designed. Its `neutral` tone is the
 * accurate one: nothing is destroyed here and nothing stops today.
 *
 * The dialog body states the date rather than a policy sentence. "Pro until 8
 * August 2027" is a fact someone can check against what they paid; "you retain
 * access for the remainder of your billing period" is a sentence people skip.
 */
function CancelPlanButton({ plan }: { plan: PlanState | null }) {
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function cancel(): Promise<void> {
    setConfirming(false)
    setSubmitting(true)
    setError(null)
    const ok = await cancelPlan()
    // On success the forced refresh has already landed and this whole branch of
    // the card is replaced by the cancelled state, so there is no success
    // message to show and nothing to reset. Only the failure path stays here.
    if (!ok) {
      setError('That did not go through. Please try again in a minute.')
      setSubmitting(false)
    }
  }

  const until = plan?.endsAt ? formatDate(plan.endsAt) : null

  return (
    <>
      <button
        type='button'
        onClick={() => setConfirming(true)}
        disabled={submitting}
        className={QUIET_BUTTON_CLASS}
      >
        {submitting ? 'Cancelling…' : 'Cancel plan'}
      </button>
      {error && (
        <p role='alert' className='mt-2 basis-full text-xs text-red-300'>
          {error}
        </p>
      )}
      <ConfirmDialog
        open={confirming}
        tone='neutral'
        title='Cancel your plan?'
        body={
          until
            ? `Your next charge is stopped. You keep Pro until ${until}, and nothing further will be charged. You can resubscribe at any time.`
            : 'Your next charge is stopped. You keep Pro to the end of the period you have already paid for, and nothing further will be charged.'
        }
        confirmLabel='Cancel my plan'
        onCancel={() => setConfirming(false)}
        onConfirm={() => void cancel()}
      />
    </>
  )
}

function PlanAction({
  bucket,
  plan,
  buyer,
}: {
  bucket: PlanBucket
  plan: PlanState | null
  buyer: Buyer | null
}) {
  switch (bucket) {
    case 'free':
      return <PlanPicker buyer={buyer} />
    // "Manage billing" is the card and the invoices; cancelling is ours, because
    // Creem's portal cancels immediately and would cost an annual subscriber the
    // months they paid for — see src/lib/billing/cancel.ts.
    case 'active-monthly':
    case 'active-annual':
      return (
        <div className='flex flex-wrap items-center gap-2'>
          <a href='/api/billing/portal' className={SECONDARY_BUTTON_CLASS}>
            Manage billing
          </a>
          <CancelPlanButton plan={plan} />
        </div>
      )
    // The one state with a genuinely urgent action, so this is the one place the
    // accent is spent on the plan card: Pro is running out for a reason the
    // customer can fix in about a minute, and burying that in a bordered button
    // next to an equally-weighted Cancel would be the wrong emphasis.
    case 'past-due':
      return (
        <div className='flex flex-wrap items-center gap-2'>
          <a href='/api/billing/portal' className={ACTION_BUTTON_CLASS}>
            Update payment method
          </a>
          <CancelPlanButton plan={plan} />
        </div>
      )
    case 'cancelled':
    case 'ended': {
      if (!buyer) return <CheckoutPendingButton />
      const label = bucket === 'cancelled' ? 'Resubscribe' : 'Subscribe again'
      const href = checkoutLink(checkoutBaseFor(plan?.variant), buyer)
      return (
        <a href={href} className={ACTION_BUTTON_CLASS}>
          {label}
        </a>
      )
    }
  }
}

/** The two buckets with a live, renewing subscription behind them. */
function isRenewing(bucket: PlanBucket): boolean {
  return bucket === 'active-monthly' || bucket === 'active-annual'
}

function PlanSection({ plan, buyer }: { plan: PlanState | null; buyer: Buyer | null }) {
  // Read at render rather than held in state: nothing on this card counts down,
  // and the only boundary it decides — has the paid period run out — is months
  // away for anyone looking at it. A ticking clock here would be a re-render per
  // second to move nothing. Server-side `plan` is always null, so this cannot
  // produce a hydration mismatch: both passes classify as `free`.
  const bucket = classifyPlan(plan, nowMs())
  const copy = planCopy(bucket, plan)

  return (
    <Surface glow radius='3xl' className='animate-card-enter p-5 shadow-2xl sm:p-6'>
      <h2 className='text-lg font-semibold text-white'>Plan</h2>
      <p className='mt-2 text-sm text-white/70'>{copy.lede}</p>
      {copy.note && <p className='mt-1 text-xs text-white/50'>{copy.note}</p>}
      <div className='mt-4'>
        <PlanAction bucket={bucket} plan={plan} buyer={buyer} />
      </div>
      {/* Said here rather than only in the Terms, because this is the screen
          someone is on when they decide to cancel, and the two things they
          want to know at that moment are whether access stops immediately
          (it does not) and whether money comes back (it does not). */}
      {isRenewing(bucket) && (
        <p className='mt-3 text-xs text-white/40'>
          Cancelling stops the next charge. Pro runs to the end of the period
          you have paid for, and charges are final.
        </p>
      )}
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

const DELETE_FAILED = 'Could not delete the account. Try again.'

/**
 * A full page load of the home page, deliberately not `useRouter().push()`.
 *
 * Both callers have just destroyed the session, and a client-side transition
 * would carry the old React tree — cached account state and all — into the
 * signed-out page. The Next lint rule that flags relative `location.href`
 * assumes a soft transition is always preferable; here the reload is the point.
 */
function hardNavigateHome(): void {
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- intentional, see above
  window.location.href = '/'
}

/**
 * The delete endpoint refuses (409) while a subscription is still entitling,
 * because deleting the row would leave Creem billing an account that no
 * longer exists. That refusal explains what to do, so it is shown as-is rather
 * than flattened into the generic failure.
 */
async function deleteFailureMessage(response: Response): Promise<string> {
  try {
    const body = await response.json()
    return typeof body?.error === 'string' ? body.error : DELETE_FAILED
  } catch {
    return DELETE_FAILED
  }
}

function AccountSection({
  identity,
  hasSubscription,
}: {
  identity: AvatarIdentity
  /** Whether Creem has a subscription for this account at all. The
   *  billing portal 404s without one, so linking it unconditionally sent
   *  free-plan visitors to an API error page. */
  hasSubscription: boolean
}) {
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  /** Which confirmation is on screen, if any. Only ever one at a time. */
  const [confirming, setConfirming] = useState<'signout-all' | 'delete' | null>(null)

  /**
   * Signing out on the account page leaves you looking at an account page you
   * no longer have an account for. Send people home instead — the same landing
   * deleting an account already used.
   */
  async function signOutAndGoHome(all = false): Promise<void> {
    await signOut(all)
    hardNavigateHome()
  }

  async function handleDelete(): Promise<void> {
    setConfirming(null)
    setDeleting(true)
    setDeleteError(null)
    try {
      const response = await fetch('/api/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delete: true }),
      })
      if (!response.ok) {
        setDeleteError(await deleteFailureMessage(response))
        setDeleting(false)
        return
      }
      await signOut()
      hardNavigateHome()
    } catch {
      setDeleteError(DELETE_FAILED)
      setDeleting(false)
    }
  }

  return (
    <Surface radius='3xl' className='animate-card-enter p-5 sm:p-6'>
      <h2 className='text-lg font-semibold text-white'>Account</h2>

      <div className='mt-3 flex items-center gap-3'>
        <Avatar identity={identity} size={44} />
        <div className='min-w-0'>
          {identity.name && (
            <p className='truncate text-sm font-semibold text-white'>{identity.name}</p>
          )}
          <p className='truncate text-sm text-white/60'>{identity.email ?? 'Signed in'}</p>
        </div>
      </div>

      <div className='mt-4 flex flex-wrap gap-3'>
        <button
          type='button'
          onClick={() => void signOutAndGoHome()}
          className={SECONDARY_BUTTON_CLASS}
        >
          Sign out
        </button>
        <button
          type='button'
          onClick={() => setConfirming('signout-all')}
          className={SECONDARY_BUTTON_CLASS}
        >
          Sign out everywhere
        </button>
      </div>

      {/* Deleting an account is irreversible and is the least likely reason
          anyone opened this page, so it does not get to sit next to "Sign out"
          as an equally-weighted button waiting to be mis-tapped. It is folded
          away behind a disclosure, and the button inside it still has to be
          confirmed — three deliberate acts, none of them reachable by accident.
          A native <details>, so the collapsed state costs no JavaScript. */}
      <details className='group mt-6 border-t border-white/10 pt-4'>
        <summary className='inline-flex list-none items-center gap-1.5 text-xs font-medium text-white/40 transition-colors hover:text-white/70'>
          <ChevronDownIcon
            className='h-3 w-3 transition-transform duration-200 group-open:rotate-180'
            aria-hidden
          />
          Close this account
        </summary>

        <div className='mt-3'>
          <p className='text-xs text-white/50'>
            {hasSubscription ? (
              // Points at the plan card rather than the billing portal: cancelling
              // is done there now, and sending someone to Creem's portal to do it
              // is exactly the path that would cost them their remaining months.
              <>
                Deleting your account does not cancel your subscription. Use{' '}
                <span className='text-white/70'>Cancel plan</span> above first, or it
                will keep renewing after the account is gone.
              </>
            ) : (
              'Deleting your account removes your email address, your preferences, and every signed-in session. It cannot be undone.'
            )}
          </p>
          <button
            type='button'
            onClick={() => setConfirming('delete')}
            disabled={deleting}
            className='btn-danger btn-press mt-3 rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50'
          >
            {deleting ? 'Deleting…' : 'Delete account'}
          </button>
          {deleteError && <p className='mt-2 text-xs text-red-300'>{deleteError}</p>}
        </div>
      </details>

      <ConfirmDialog
        open={confirming === 'signout-all'}
        tone='neutral'
        title='Sign out everywhere?'
        body='Every device currently signed in to this account will be signed out, including this one. Nothing else changes, and you can sign back in with Google at any time.'
        confirmLabel='Sign out everywhere'
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          setConfirming(null)
          void signOutAndGoHome(true)
        }}
      />
      <ConfirmDialog
        open={confirming === 'delete'}
        title='Delete your account?'
        body={
          hasSubscription
            ? 'This does not cancel your subscription. It will keep renewing after the account is gone, so use "Cancel plan" on your plan card first. Your email address, preferences and sessions are removed, and this cannot be undone.'
            : 'Your email address, preferences and every signed-in session are removed. This cannot be undone.'
        }
        confirmLabel='Delete my account'
        onCancel={() => setConfirming(null)}
        onConfirm={() => void handleDelete()}
      />
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

/**
 * Stands in for the plan card alone, at the size the card resolves to.
 *
 * Only reached by someone the profile cache remembers as paying: their plan is
 * the one thing on this page the browser cannot answer on its own, and
 * guessing "free" at somebody who is paying is worse than a moment of loading.
 * Everyone else gets the real card immediately.
 *
 * ponytail: sized to the free/cancelled card, so a Pro card that lands with a
 * renewal note is ~20px taller and settles by that much. Measure and pin the
 * taller height if it ever reads as a jump.
 */
function PlanPlaceholder() {
  return (
    <Surface
      glow
      radius='3xl'
      aria-hidden
      className='animate-pulse h-[152px] p-5 shadow-2xl sm:h-40 sm:p-6'
    />
  )
}

/**
 * Shown instead of the skeleton when the refresh could not be answered at all.
 * The retry is a button, not a timer: nothing on this page may poll.
 */
function LoadFailed() {
  const [retrying, setRetrying] = useState(false)

  async function retry(): Promise<void> {
    setRetrying(true)
    await refreshAccount()
    setRetrying(false)
  }

  return (
    <Surface radius='3xl' className='animate-card-enter p-6 text-center sm:p-8'>
      <p className='text-sm text-white/70'>
        We couldn&rsquo;t load your account. Accounts may not be switched on yet, or the connection
        dropped.
      </p>
      <button
        type='button'
        onClick={() => void retry()}
        disabled={retrying}
        className={`${SECONDARY_BUTTON_CLASS} mt-4 disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {retrying ? 'Trying…' : 'Try again'}
      </button>
    </Surface>
  )
}

function SignInPrompt() {
  return (
    <Surface glow radius='3xl' className='animate-card-enter p-6 text-center sm:p-8'>
      <p className='text-sm text-white/70'>Sign in to see your plan and manage your account.</p>
      {/* Home, not back to this page. Signing in is a means to using the
          downloader, so it ends where the downloader is. */}
      <a href={signInHref()} className={`${ACTION_BUTTON_CLASS} mt-4`}>
        Sign in with Google
      </a>
    </Surface>
  )
}

/**
 * Polls `refreshAccount({ force: true })` for up to 30s after a Creem
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

  // Pro wins over the phase, rather than waiting for the next tick to notice.
  // `tick` is what clears the interval, so the phase it holds lags the state
  // change by up to one interval, and the whole point of this notice is to be
  // gone the instant there is a plan to show. It also covers the case where
  // the repair lands after the 30s timeout: someone looking at their own live
  // subscription must not be told it is still being set up.
  return pro ? 'idle' : phase
}

/**
 * Why the billing portal sent someone back here instead of to Creem.
 *
 * `/api/billing/portal` has to be a server round trip — Creem mints and
 * expires portal URLs, so one is generated per click — and
 * it used to answer its failures as raw JSON. A visitor who clicked it with no
 * subscription landed on `{"success":false,"error":"No subscription"}` with no
 * way back. It now redirects here with a reason instead.
 */
const NOTICES: Record<string, Record<string, string>> = {
  billing: {
    none: 'There is no subscription on this account, so there is nothing to manage yet.',
    unavailable: 'The billing portal could not be opened just now. Please try again in a minute.',
  },
  /**
   * A sign-in that came back from Google without a usable session. Sent here
   * rather than answered as JSON for the same reason as the billing portal:
   * these are reached by a browser following a redirect, so the reply is a
   * page, and a page has to offer a way forward. The prompt below this notice
   * is that way forward.
   */
  signin: {
    expired:
      'That sign-in took too long, or it started in a different browser. Please try again from here.',
    failed: 'Google could not complete the sign-in. Please try again.',
    email: 'Google did not return a verified email address, so no account could be created.',
  },
}

/**
 * Read during render rather than in an effect: the query string is fixed for
 * the life of the page, so there is nothing to synchronise and no reason to
 * pay a second render for it. `useHydrated` is what keeps `window` out of the
 * prerender.
 */
function useNotice(): string | null {
  const hydrated = useHydrated()
  if (!hydrated) return null
  const params = new URLSearchParams(window.location.search)
  for (const [key, messages] of Object.entries(NOTICES)) {
    const value = params.get(key)
    if (value && value in messages) return messages[value]
  }
  return null
}

function Notice({ children }: { children: string }) {
  return (
    <Surface tone='accent' radius='2xl' className='p-4 text-sm text-white/80'>
      {children}
    </Surface>
  )
}

export function AccountPanel() {
  const { signedIn, failed, userId, pro, email, name, picture, plan } = useAccount()
  const hydrated = useHydrated()
  const checkoutPhase = useCheckoutPolling(pro)
  const notice = useNotice()
  // Read once. Safe as a lazy initialiser despite touching localStorage: it
  // catches and returns null on the server, and nothing renders from it until
  // `hydrated`, so it can never reach the markup React compares.
  const [cached] = useState(cachedProfile)

  // No hint cookie means no session to load, so there is nothing to ask the
  // Worker and no request that could fail on the way.
  const syncAccount = (): void => {
    if (hasAccountHint()) void refreshAccount()
    else markSignedOut()
  }

  useEffect(syncAccount, [])
  // Again whenever this page comes back into view. The session can have been
  // created or destroyed somewhere this document never heard about: another
  // tab, or the installed app, which is where Android can land the OAuth
  // callback even when the sign-in started here. `refreshAccount` is a no-op
  // while the token in hand is still fresh, so a tab merely being switched
  // back to costs nothing.
  useOnPageVisible(syncAccount)

  if (signedIn === undefined && failed) return <LoadFailed />

  // Until hydration finishes, the markup has to be what was prerendered.
  // `useHydrated` settles in the re-render React does immediately after
  // hydrating, before the browser paints, so nothing below is ever seen
  // shifting into place.
  if (!hydrated && signedIn === undefined) return <Skeleton />

  /**
   * What the browser already knows, for free.
   *
   * The hint cookie is the client's own answer to "is there a session?", and
   * the profile cache is its answer to "whose?" — both written at sign-in,
   * both readable with no request. The page used to ignore all of it and show
   * three pulsing blocks until a round trip came back, then swap in three
   * cards of entirely different heights. That reflow was the single largest
   * layout shift on the site, and it fired on every visit to this page.
   *
   * Now only the genuinely unknown part waits. A signed-out visitor is
   * answered on the first frame; a signed-in one gets their preferences and
   * account card immediately, because both render from local state alone.
   */
  const settled = signedIn ?? hasAccountHint()

  // The notice has to survive this branch: a failed sign-in lands here signed
  // out, and the reason it failed is the only thing worth reading on the page.
  if (!settled) {
    return (
      <div className='space-y-6'>
        {notice && <Notice>{notice}</Notice>}
        <SignInPrompt />
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      {checkoutPhase !== 'idle' && (
        <Notice>
          {checkoutPhase === 'polling'
            ? 'Setting up your subscription…'
            : 'Your payment went through. This can take a minute — refresh, or email us if it persists.'}
        </Notice>
      )}
      {notice && <Notice>{notice}</Notice>}
      {/* The plan is the one card the browser cannot answer on its own. It
          waits only for someone the cache remembers as paying; for everyone
          else `plan: null` IS their plan, so the real card renders at once. */}
      {signedIn === undefined && cached?.pro ? (
        <PlanPlaceholder />
      ) : (
        <PlanSection plan={plan} buyer={buyerOf(userId)} />
      )}
      <PreferencesSection />
      <AccountSection
        identity={{
          // The cache covers all three while the refresh is in flight, so the
          // avatar and name paint on the first frame rather than fading in.
          name: name ?? cached?.name ?? null,
          email: email ?? cached?.email ?? null,
          picture: picture ?? cached?.picture ?? null,
        }}
        hasSubscription={plan?.status !== null && plan?.status !== undefined}
      />
    </div>
  )
}
