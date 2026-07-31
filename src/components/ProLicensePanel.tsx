'use client'

import { useId, useState } from 'react'
import { activateLicense, clearLicense, useTier } from '@/lib/entitlements'

/**
 * Server messages that mean "this was not about your key" — a dead upstream,
 * a timeout, or this deployment not having licensing configured at all (see
 * the 502/503 branches in src/lib/apiRoutes.ts's handleLicense). Anything
 * else reaching this component is the 400 class: the key itself was rejected
 * or the request was malformed, which is fair to describe as a key problem.
 *
 * activateLicense only ever hands back a message string, not the HTTP status
 * it came from, so text is the only signal available here — and it is a
 * reliable one, since apiRoutes.ts writes exactly these two strings for the
 * unavailable cases and nothing else does.
 */
const SERVER_UNAVAILABLE_MESSAGES = new Set<string>([
  'Could not reach the license server. Try again.',
  'Licensing is not configured on this deployment.',
])

function isServerUnavailableError(message: string): boolean {
  return SERVER_UNAVAILABLE_MESSAGES.has(message)
}

type FormState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string; unavailable: boolean }

/**
 * The only interactive part of /pro. Everything else on the page is static
 * marketing copy; this is the form that actually calls the license API and
 * the panel that shows the active state once a key is accepted.
 */
export function ProLicensePanel() {
  const tier = useTier()
  const inputId = useId()
  const [key, setKey] = useState('')
  const [form, setForm] = useState<FormState>({ status: 'idle' })

  if (tier === 'pro') {
    return (
      <div className='rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.06] p-5 sm:p-6'>
        <div className='flex items-center gap-2'>
          <span className='h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]' />
          <p className='font-semibold text-white'>Pro is active on this browser</p>
        </div>
        <p className='mt-2 text-sm text-white/60'>
          No account was created — this browser is the only place your license
          lives. Activating on another device or browser uses one of your key&rsquo;s
          three activation slots.
        </p>
        <button
          type='button'
          onClick={() => clearLicense()}
          className='mt-4 rounded-lg border border-white/15 bg-white/5 px-3.5 py-2 text-sm font-medium text-white/70 transition-colors hover:text-white'
        >
          Remove this license from this browser
        </button>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = key.trim()
    if (!trimmed || form.status === 'loading') return
    setForm({ status: 'loading' })
    const result = await activateLicense(trimmed)
    if (result.ok) {
      setForm({ status: 'idle' })
      return
    }
    setForm({
      status: 'error',
      message: result.error,
      unavailable: isServerUnavailableError(result.error),
    })
  }

  return (
    <form onSubmit={handleSubmit} className='rounded-2xl border border-white/[0.1] bg-white/[0.03] p-5 sm:p-6'>
      <label htmlFor={inputId} className='block text-sm font-semibold text-white'>
        Already bought a key?
      </label>
      <p className='mt-1 text-sm text-white/60'>
        Paste your license key below to activate Pro on this browser.
      </p>
      <div className='mt-3 flex flex-col gap-2 sm:flex-row'>
        <input
          id={inputId}
          type='text'
          inputMode='text'
          autoComplete='off'
          spellCheck={false}
          placeholder='XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX'
          value={key}
          onChange={(e) => setKey(e.target.value)}
          className='w-full flex-1 rounded-lg border border-white/15 bg-black/30 px-3.5 py-2.5 font-mono text-sm text-white placeholder:text-white/30 focus:border-cyan-400/50 focus:outline-none'
        />
        <button
          type='submit'
          disabled={form.status === 'loading' || key.trim().length === 0}
          className='btn-grad shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50'
        >
          {form.status === 'loading' ? 'Activating…' : 'Activate'}
        </button>
      </div>
      {form.status === 'error' && (
        <p role='alert' className='mt-3 text-sm text-amber-300'>
          {form.message}
          {form.unavailable
            ? ' This is not a problem with your key — please try again in a moment.'
            : null}
        </p>
      )}
    </form>
  )
}
