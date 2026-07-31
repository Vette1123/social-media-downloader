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
 *
 * The two are split rather than lumped into one "unavailable" bucket: a dead
 * upstream is transient, so "try again in a moment" is honest advice — but
 * "not configured on this deployment" is a fixed deployment condition, and no
 * amount of retrying will ever change it. Matched by exact string, not
 * rewritten, so this stays in sync with the wire strings apiRoutes.ts returns.
 */
const TRANSIENT_SERVER_MESSAGE = 'Could not reach the license server. Try again.'
const NOT_CONFIGURED_MESSAGE = 'Licensing is not configured on this deployment.'

type ServerErrorKind = 'key' | 'transient' | 'not-configured'

function serverErrorKind(message: string): ServerErrorKind {
  if (message === TRANSIENT_SERVER_MESSAGE) return 'transient'
  if (message === NOT_CONFIGURED_MESSAGE) return 'not-configured'
  return 'key'
}

/**
 * Retrying only ever helps the transient case — a dead upstream may answer
 * next time. "Not configured" is a deployment condition retrying can never
 * fix, so it gets its own explanation instead of the retry suffix.
 */
function errorSuffix(kind: ServerErrorKind): string | null {
  if (kind === 'transient') {
    return ' This is not a problem with your key — please try again in a moment.'
  }
  if (kind === 'not-configured') {
    return ' Licensing isn’t live on this site yet — this is not a problem with your key.'
  }
  return null
}

type FormState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string; kind: ServerErrorKind }

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
          five activation slots.
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
      kind: serverErrorKind(result.error),
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
          {errorSuffix(form.kind)}
        </p>
      )}
    </form>
  )
}
