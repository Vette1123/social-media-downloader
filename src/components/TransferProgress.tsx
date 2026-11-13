'use client'

import { useMemo, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react'
import { SpinnerIcon } from '@/components/icons'
import {
  describeProgress,
  getProgressServerSnapshot,
  getProgressSnapshot,
  READOUT_SEPARATOR,
  subscribeProgress,
} from '@/lib/downloadProgress'
import { useT } from '@/lib/i18nStore'

/**
 * The download progress UI, in two pieces that never change size.
 *
 * It used to be a separate block (bar, text line, Cancel) that replaced a
 * one-line hint the moment a download started and vanished when it ended. That
 * moved the page twice per download and, on a typical 2 MB clip, flashed for
 * under a second. Now the button that started the transfer becomes its bar,
 * and the line under the buttons is a fixed-height slot whose two faces
 * (hint / readout + Cancel) crossfade in place.
 */

interface TransferButtonProps {
  busy: boolean
  /** 0–100 once the size is known; null while the transfer is still starting. */
  pct: number | null
  /** What the button says while busy without a percentage yet. */
  waitingLabel: string
  /** What the button says with a percentage. */
  progressLabel: (pct: number) => string
  /** The resting face: icon + label. */
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  /** Look and size only (btn-grad / btn-ghost, padding, radius). */
  className: string
}

export function TransferButton({
  busy,
  pct,
  waitingLabel,
  progressLabel,
  children,
  onClick,
  disabled,
  className,
}: TransferButtonProps) {
  const label = pct === null ? waitingLabel : progressLabel(pct)
  // Two copies of the busy face: light text on the track, dark text on the
  // fill. The fill is clipped to the percentage, so the text changes colour
  // exactly where the bar's edge crosses it.
  const face = (
    <span className='relative flex min-w-0 items-center gap-2 tabular-nums'>
      {pct === null && <SpinnerIcon className='h-4 w-4 flex-shrink-0' />}
      <span className='truncate'>{label}</span>
    </span>
  )
  const fillStyle = { '--xfer-pct': pct ?? 0 } as CSSProperties
  return (
    <button
      type='button'
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy}
      data-busy={busy}
      className={`xfer relative overflow-hidden ${className}`}
    >
      {busy ? (
        <>
          {pct === null && <span className='xfer-sheen' aria-hidden />}
          {face}
          <span aria-hidden className='xfer-fill grad-fill' style={fillStyle}>
            {face}
          </span>
        </>
      ) : (
        children
      )}
    </button>
  )
}

/**
 * The line under the download buttons. Same height idle and busy: the hint
 * and the readout share one grid cell and only their opacity changes.
 */
export function TransferStatus({
  busy,
  pct,
  onCancel,
  idleAction,
}: {
  busy: boolean
  pct: number | null
  onCancel: () => void
  /** Replaces the idle hint with a follow-up, e.g. "Send to an app". */
  idleAction?: { label: string; onClick: () => void }
}) {
  const detail = useSyncExternalStore(
    subscribeProgress,
    getProgressSnapshot,
    getProgressServerSnapshot,
  )
  const t = useT()
  const words = useMemo(
    () => ({
      seconds: (n: number) => t('etaSeconds', { n }),
      minutes: (n: number) => t('etaMinutes', { n }),
    }),
    [t],
  )
  const readout = readoutText(busy, pct, describeProgress(detail, undefined, words), t)
  return (
    <div className='grid h-8 items-center text-xs'>
      {idleAction ? (
        <button
          type='button'
          data-on={!busy}
          onClick={idleAction.onClick}
          className='xfer-layer btn-press animate-section-in mx-auto rounded-lg border border-white/25 px-3 py-1 font-semibold text-white/85 transition-colors hover:bg-white/10'
        >
          {idleAction.label}
        </button>
      ) : (
        <p data-on={!busy} className='xfer-layer text-center text-white/50'>
          {t('clickToDownload')}
        </p>
      )}
      <div
        data-on={busy}
        className='xfer-layer flex min-w-0 items-center justify-between gap-3'
      >
        <span
          role='progressbar'
          aria-label={t('downloadingBtn')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct ?? undefined}
          className='min-w-0 truncate tabular-nums text-white/60'
        >
          {/* Each segment isolated: in Arabic, "1.2 MB / 8.4 MB" next to
              RTL words otherwise reorders its own numbers. */}
          {readout.split(READOUT_SEPARATOR).map((part, i) => (
            <span key={i}>
              {i > 0 && READOUT_SEPARATOR}
              <bdi>{part}</bdi>
            </span>
          ))}
        </span>
        {/* Cancel owns the transfer: for a long file stopping is the
            second-most-likely action, and pressing Download again undoes it. */}
        <button
          type='button'
          onClick={onCancel}
          className='btn-press flex-shrink-0 rounded-lg px-2.5 py-1 font-semibold text-white/60 transition-colors hover:bg-white/10 hover:text-white'
        >
          {t('cancelDownload')}
        </button>
      </div>
    </div>
  )
}

function readoutText(
  busy: boolean,
  pct: number | null,
  bytes: string,
  t: ReturnType<typeof useT>,
): string {
  if (!busy) return ''
  if (pct === null) return t('preparingDownload')
  return bytes || t('progressLine', { pct })
}
