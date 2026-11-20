import React from 'react'
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame } from 'remotion'
import { PLATFORM_GLYPHS } from '@/lib/ogGlyphs'
import { Backdrop, Browser, Cursor, Mark, Phone, Pill, Tile, Words, ease, useLayout, useSpring } from './components/kit'
import { C, FONT, GRADIENT, IN_OUT, OUT_EXPO } from './theme'

const SITE = 'socialdownloader.space'
const LINK = 'https://t.me/durov/566'
const shot = (name: string) => staticFile(`shots/${name}.png`)

/** The fourteen platforms, in the order the site lists them (the generic tile is not one). */
const PLATFORMS = Object.entries(PLATFORM_GLYPHS).filter(([slug]) => slug !== 'video-downloader')
const NAMES: Record<string, string> = {
  'tiktok-downloader': 'TikTok',
  'twitter-video-downloader': 'X',
  'instagram-downloader': 'Instagram',
  'facebook-downloader': 'Facebook',
  'youtube-downloader': 'YouTube',
  'pinterest-downloader': 'Pinterest',
  'reddit-video-downloader': 'Reddit',
  'threads-video-downloader': 'Threads',
  'snapchat-downloader': 'Snapchat',
  'twitch-clip-downloader': 'Twitch',
  'vimeo-downloader': 'Vimeo',
  'dailymotion-downloader': 'Dailymotion',
  'linkedin-video-downloader': 'LinkedIn',
  'telegram-downloader': 'Telegram',
}

/** Deterministic 0..1 per index, so the feed looks random and renders the same every time. */
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

const CARD_GRADIENTS = [
  'linear-gradient(160deg, #0f766e, #1e1b4b)',
  'linear-gradient(160deg, #7c3aed, #0f172a)',
  'linear-gradient(160deg, #be185d, #1e1b4b)',
  'linear-gradient(160deg, #0369a1, #020617)',
  'linear-gradient(160deg, #ca8a04, #431407)',
  'linear-gradient(160deg, #15803d, #052e16)',
]

/** One post in an endless feed: a clip, a platform badge, a handle and a scrubber. */
const FeedCard: React.FC<{ i: number; w: number }> = ({ i, w }) => {
  const [, glyph] = PLATFORMS[i % PLATFORMS.length]
  return (
    <div
      style={{
        width: w,
        height: w * 1.6,
        borderRadius: w * 0.07,
        background: CARD_GRADIENTS[i % CARD_GRADIENTS.length],
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(60% 40% at ${30 + hash(i) * 40}% ${30 + hash(i + 9) * 30}%, rgba(255,255,255,0.22), transparent 70%)`,
        }}
      />
      <Tile glyph={glyph} size={w * 0.16} style={{ position: 'absolute', top: w * 0.06, left: w * 0.06 }} />
      <svg width={w * 0.22} height={w * 0.22} viewBox='0 0 24 24' style={{ position: 'absolute', left: '50%', top: '45%', transform: 'translate(-50%,-50%)', opacity: 0.85 }}>
        <circle cx='12' cy='12' r='11' fill='rgba(0,0,0,0.35)' />
        <path d='M9.5 7.5v9l7-4.5z' fill='#fff' />
      </svg>
      <div style={{ position: 'absolute', left: w * 0.07, bottom: w * 0.16, width: w * (0.35 + hash(i + 3) * 0.3), height: w * 0.035, borderRadius: w, background: 'rgba(255,255,255,0.75)' }} />
      <div style={{ position: 'absolute', left: w * 0.07, bottom: w * 0.1, width: w * (0.5 + hash(i + 5) * 0.3), height: w * 0.025, borderRadius: w, background: 'rgba(255,255,255,0.4)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: w * 0.02, background: 'rgba(255,255,255,0.2)' }}>
        <div style={{ width: `${20 + hash(i + 7) * 70}%`, height: '100%', background: '#fff' }} />
      </div>
    </div>
  )
}

/** Beats 0-6. The feed won't stop, and the one clip you want won't save. */
export const Hook: React.FC = () => {
  const frame = useCurrentFrame()
  const { landscape, heading, width } = useLayout()
  const card = landscape ? 260 : 300
  const speed = interpolate(frame, [0, 170], [3, 14], { extrapolateRight: 'clamp', easing: IN_OUT })
  const travel = frame * speed
  const cols = landscape ? 7 : 5
  const shake = [120, 135, 150, 165].reduce((acc, at) => acc + Math.sin((frame - at) * 2.6) * 14 * (1 - ease(frame, at, 12)) * (frame >= at ? 1 : 0), 0)
  const toast = ease(frame, 106, 16)
  const black = interpolate(frame, [168, 173], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill>
      <Backdrop glow={0.6} />
      <AbsoluteFill style={{ perspective: 1800, alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            display: 'flex',
            gap: card * 0.14,
            transform: `rotateX(32deg) rotateZ(-14deg) scale(${landscape ? 1.25 : 1.5})`,
            opacity: 0.5,
          }}
        >
          {Array.from({ length: cols }, (_, c) => {
            const offset = ((travel * (0.8 + hash(c) * 0.5) + c * 170) % (card * 1.74)) - card * 1.74
            return (
              <div key={c} style={{ display: 'flex', flexDirection: 'column', gap: card * 0.14, transform: `translateY(${-offset - card * 3}px)` }}>
                {Array.from({ length: 6 }, (_, r) => (
                  <FeedCard key={r} i={c * 6 + r} w={card} />
                ))}
              </div>
            )
          })}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'radial-gradient(60% 55% at 50% 50%, rgba(7,8,11,0.88) 0%, rgba(7,8,11,0.55) 60%, rgba(7,8,11,0.2) 100%)' }} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', padding: landscape ? '0 200px' : '0 90px', textAlign: 'center' }}>
        <div style={{ position: 'absolute', width: width - (landscape ? 400 : 180) }}>
          <Words text='You found the perfect video.' from={6} size={heading} align='center' accent={['perfect']} out={82} />
        </div>
        <div style={{ position: 'absolute', width: width - (landscape ? 400 : 180), transform: `translateX(${shake}px)` }}>
          <Words text={landscape ? "Then the app won't | let you keep it." : "Then the app won't let you keep it."} from={90} size={heading} align='center' stagger={3} />
          <div
            style={{
              marginTop: heading * 0.5,
              display: 'flex',
              justifyContent: 'center',
              opacity: toast,
              transform: `translateY(${(1 - toast) * 30}px) scale(${0.9 + toast * 0.1})`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '18px 30px',
                borderRadius: 22,
                background: 'rgba(127,29,29,0.55)',
                border: '1px solid rgba(248,113,113,0.5)',
                fontFamily: FONT,
                fontWeight: 600,
                fontSize: landscape ? 32 : 38,
                color: '#fecaca',
                boxShadow: '0 20px 60px rgba(220,38,38,0.25)',
              }}
            >
              <svg width='34' height='34' viewBox='0 0 24 24' fill='none' stroke='#f87171' strokeWidth='2.6' strokeLinecap='round'>
                <circle cx='12' cy='12' r='9.5' />
                <path d='M9 9l6 6M15 9l-6 6' />
              </svg>
              Saving is turned off for this video
            </div>
          </div>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: '#000', opacity: black }} />
    </AbsoluteFill>
  )
}

/** Beat 6, the drop: the mark lands out of a flash, the promise under it. */
export const Drop: React.FC = () => {
  const frame = useCurrentFrame()
  const { landscape, heading } = useLayout()
  const land = useSpring(0, 140, 16)
  const flash = interpolate(frame, [0, 2, 18], [0, 0.85, 0], { extrapolateRight: 'clamp' })
  const markSize = landscape ? 210 : 260
  const ring = (at: number) => ease(frame, at, 40, OUT_EXPO)
  return (
    <AbsoluteFill>
      <Backdrop glow={1.4} seed={1} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            position: 'absolute',
            width: 1800,
            height: 1800,
            background: 'conic-gradient(from 0deg, transparent 0deg, rgba(34,211,238,0.10) 12deg, transparent 24deg, transparent 60deg, rgba(99,102,241,0.10) 72deg, transparent 84deg, transparent 120deg, rgba(45,212,191,0.10) 132deg, transparent 144deg, transparent 180deg, rgba(34,211,238,0.10) 192deg, transparent 204deg, transparent 240deg, rgba(99,102,241,0.10) 252deg, transparent 264deg, transparent 300deg, rgba(45,212,191,0.10) 312deg, transparent 324deg)',
            transform: `rotate(${frame * 0.25}deg) scale(${0.6 + land * 0.4})`,
            maskImage: 'radial-gradient(closest-side, black 0%, transparent 100%)',
            opacity: land,
          }}
        />
        {[0, 7].map((at) => (
          <div
            key={at}
            style={{
              position: 'absolute',
              width: markSize,
              height: markSize,
              borderRadius: '50%',
              border: `${4 - ring(at) * 3}px solid rgba(94,234,212,${0.7 * (1 - ring(at))})`,
              transform: `translateY(${landscape ? -150 : -260}px) scale(${1 + ring(at) * 5})`,
            }}
          />
        ))}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', transform: `translateY(${landscape ? -10 : -40}px)` }}>
          <Mark
            size={markSize}
            style={{
              transform: `scale(${2.4 - land * 1.4})`,
              filter: `blur(${(1 - Math.min(1, land)) * 20}px) drop-shadow(0 30px 80px rgba(34,211,238,0.45))`,
            }}
          />
          <div style={{ height: landscape ? 50 : 70 }} />
          <Words text='Social Media Downloader' from={14} size={landscape ? 44 : 52} weight={600} color={C.dim} align='center' stagger={3} />
          <div style={{ height: landscape ? 22 : 34 }} />
          <div style={{ display: 'flex', flexDirection: landscape ? 'row' : 'column', alignItems: 'center', columnGap: heading * 0.3 }}>
            <Words text='Any video.' from={26} size={heading * 1.2} align='center' />
            <Words text='Any app.' from={34} size={heading * 1.2} align='center' accent={['Any', 'app']} />
          </div>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 42%, #ffffff 0%, rgba(165,243,252,0.6) 30%, transparent 70%)', opacity: flash }} />
    </AbsoluteFill>
  )
}

/** Where the browser sits in the paste and result scenes: the same window, so the cut reads as one shot. */
function useStage() {
  const { landscape } = useLayout()
  return landscape
    ? { width: 1080, left: 760, top: 175, captionLeft: 130, captionTop: 330, captionWidth: 610 }
    : { width: 980, left: 50, top: 820, captionLeft: 90, captionTop: 250, captionWidth: 900 }
}

const Caption: React.FC<{ title: string; sub: string; accent: string[]; from?: number }> = ({ title, sub, accent, from = 8 }) => {
  const { heading, sub: subSize } = useLayout()
  const s = useStage()
  return (
    <div style={{ position: 'absolute', left: s.captionLeft, top: s.captionTop, width: s.captionWidth }}>
      <Words text={title} from={from} size={heading} accent={accent} />
      <div style={{ height: subSize * 0.8 }} />
      <Words text={sub} from={from + 14} size={subSize} weight={400} color={C.dim} stagger={2} />
    </div>
  )
}

/** Beats 10-18. A link goes in. */
export const Paste: React.FC = () => {
  const frame = useCurrentFrame()
  const { landscape } = useLayout()
  const s = useStage()
  const enter = useSpring(0, 90, 20)
  const typed = Math.floor(interpolate(frame, [44, 104], [0, LINK.length], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }))
  const caret = typed < LINK.length || Math.floor(frame / 18) % 2 === 0
  const bar = useSpring(26, 110, 18)
  const press = interpolate(frame, [124, 128, 136], [1, 0.95, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const working = ease(frame, 130, 10)
  const found = ease(frame, 196, 16)
  const spin = frame * 9
  const barW = landscape ? 860 : 900
  return (
    <AbsoluteFill>
      <Backdrop seed={2} />
      <Caption title='Paste any link.' sub='TikTok, Instagram, YouTube, X and ten more.' accent={['link']} />
      <AbsoluteFill style={{ perspective: 2200 }}>
        <div
          style={{
            position: 'absolute',
            left: s.left,
            top: s.top,
            transform: `translateX(${(1 - enter) * 500}px) rotateY(${landscape ? -16 + enter * 6 : 0}deg) rotateX(${6 - enter * 2}deg) scale(${0.9 + enter * 0.1})`,
            transformOrigin: 'left center',
            opacity: Math.min(1, enter * 1.4),
          }}
        >
          <Browser src={shot('home-desktop')} width={s.width} url={SITE} scroll={interpolate(frame, [0, 240], [0, 0.04])} />
        </div>
        <div
          style={{
            position: 'absolute',
            left: landscape ? s.left + 60 : 90,
            top: landscape ? s.top + 470 : s.top + 700,
            width: barW,
            transform: `translateY(${(1 - bar) * 80}px) scale(${(0.92 + bar * 0.08) * press})`,
            opacity: bar,
          }}
        >
          <div
            style={{
              display: 'flex',
              gap: 18,
              padding: 18,
              borderRadius: 30,
              background: 'rgba(16,19,26,0.82)',
              border: '1px solid rgba(255,255,255,0.14)',
              backdropFilter: 'blur(18px)',
              boxShadow: '0 40px 100px rgba(0,0,0,0.6), 0 0 80px rgba(34,211,238,0.18)',
              flexDirection: landscape ? 'row' : 'column',
            }}
          >
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                padding: '0 24px',
                height: 86,
                borderRadius: 20,
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${typed > 0 ? 'rgba(34,211,238,0.6)' : 'rgba(255,255,255,0.1)'}`,
                fontFamily: FONT,
                fontSize: 34,
                color: typed > 0 ? C.ink : C.dim,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              {typed > 0 ? LINK.slice(0, typed) : 'Paste a video link'}
              <div style={{ width: 3, height: 40, marginLeft: 4, background: C.cyan, opacity: caret ? 1 : 0 }} />
            </div>
            <div
              style={{
                height: 86,
                minWidth: 250,
                borderRadius: 20,
                background: GRADIENT,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 14,
                fontFamily: FONT,
                fontWeight: 600,
                fontSize: 34,
                color: '#04171b',
                boxShadow: `0 0 ${40 + working * 50}px rgba(34,211,238,${0.35 + working * 0.3})`,
              }}
            >
              {working > 0 && found < 1 && (
                <svg width='34' height='34' viewBox='0 0 24 24' style={{ transform: `rotate(${spin}deg)` }}>
                  <circle cx='12' cy='12' r='9' fill='none' stroke='rgba(4,23,27,0.25)' strokeWidth='3' />
                  <path d='M12 3a9 9 0 0 1 9 9' fill='none' stroke='#04171b' strokeWidth='3' strokeLinecap='round' />
                </svg>
              )}
              {found >= 1 ? 'Found it' : 'Download'}
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}

/** Beats 18-26. The real result, then the file lands. */
export const Result: React.FC = () => {
  const frame = useCurrentFrame()
  const { landscape } = useLayout()
  const s = useStage()
  const push = interpolate(frame, [16, 100], [1, landscape ? 1.55 : 1.5], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: IN_OUT })
  const contentH = s.width * 0.625
  // The "Video" button in the capture, in capture pixels at this browser width.
  const btn: [number, number] = [s.width * 0.387, contentH * 0.333]
  const click = 118
  const glow = interpolate(frame, [click, click + 4, click + 40], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const toast = useSpring(click + 8, 120, 18)
  const progress = ease(frame, click + 14, 70, IN_OUT)
  const saved = ease(frame, click + 86, 14)
  return (
    <AbsoluteFill>
      <Backdrop seed={3} />
      <Caption title='Keep the original.' sub='HD video, MP3 audio, whole carousels.' accent={['original']} />
      <AbsoluteFill style={{ perspective: 2200 }}>
        <div
          style={{
            position: 'absolute',
            left: s.left,
            top: s.top,
            transform: `rotateY(${landscape ? -10 : 0}deg) rotateX(4deg)`,
            transformOrigin: 'left center',
          }}
        >
          <Browser src={shot('result-desktop')} width={s.width} url={`${SITE}`} zoom={push} origin={[38, 30]}>
            <div
              style={{
                position: 'absolute',
                left: btn[0] - 150,
                top: btn[1] - 45,
                width: 300,
                height: 90,
                borderRadius: 18,
                boxShadow: `0 0 ${60 * glow}px rgba(94,234,212,${glow}), inset 0 0 0 ${3 * glow}px rgba(255,255,255,${glow * 0.8})`,
              }}
            />
            <div style={{ position: 'absolute', inset: 0, transform: `scale(${1 / push})`, transformOrigin: `${btn[0]}px ${btn[1]}px` }}>
              <Cursor
                size={46}
                click={click}
                path={[
                  [40, btn[0] + 260, btn[1] + 220],
                  [108, btn[0] - 6, btn[1] - 4],
                ]}
              />
            </div>
          </Browser>
        </div>
      </AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          right: landscape ? 110 : 90,
          bottom: landscape ? 90 : 230,
          width: landscape ? 520 : 900,
          opacity: toast,
          transform: `translateY(${(1 - toast) * 70}px) scale(${0.94 + toast * 0.06})`,
          padding: 28,
          borderRadius: 28,
          background: 'rgba(16,19,26,0.9)',
          border: `1px solid ${saved > 0 ? 'rgba(74,222,128,0.5)' : 'rgba(255,255,255,0.14)'}`,
          boxShadow: '0 40px 100px rgba(0,0,0,0.6)',
          fontFamily: FONT,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ width: 70, height: 70, borderRadius: 18, background: GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width='34' height='34' viewBox='0 0 24 24' fill='none' stroke='#04171b' strokeWidth='2.6' strokeLinecap='round' strokeLinejoin='round'>
              <path d='M12 4v11m0 0l-5-5m5 5l5-5M5 20h14' />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 30, fontWeight: 600, color: C.ink }}>durov-566.mp4</div>
            <div style={{ fontSize: 24, color: C.dim, marginTop: 4 }}>HD video · original quality</div>
          </div>
          <div style={{ fontSize: 28, fontWeight: 600, color: saved > 0 ? '#86efac' : C.cyan, minWidth: 110, textAlign: 'right' }}>
            {saved > 0 ? 'Saved ✓' : `${Math.round(progress * 100)}%`}
          </div>
        </div>
        <div style={{ marginTop: 22, height: 10, borderRadius: 10, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <div style={{ width: `${progress * 100}%`, height: '100%', background: saved > 0 ? C.green : GRADIENT, boxShadow: `0 0 20px ${C.cyan}` }} />
        </div>
      </div>
    </AbsoluteFill>
  )
}

/** Beats 26-36. Every app, orbiting the one box. */
export const Platforms: React.FC = () => {
  const frame = useCurrentFrame()
  const { landscape, heading, sub } = useLayout()
  const appear = useSpring(0, 80, 18)
  const R = landscape ? 430 : 400
  const cx = landscape ? 1300 : 540
  const cy = landscape ? 560 : 1180
  const lit = Math.floor(Math.max(0, frame - 30) / 15) % PLATFORMS.length
  const current = NAMES[PLATFORMS[lit][0]]
  const swap = (frame - 30) % 15
  const nameIn = frame < 30 ? 0 : ease(swap, 0, 8)
  const outro = ease(frame, 232, 18)
  return (
    <AbsoluteFill>
      <Backdrop glow={1.2} seed={4} />
      <div style={{ position: 'absolute', left: cx, top: cy, transform: 'translate(-50%,-50%)' }}>
        <div style={{ position: 'absolute', left: -R * 1.05, top: -R * 0.32, width: R * 2.1, height: R * 0.64, borderRadius: '50%', border: '1px solid rgba(94,234,212,0.18)' }} />
        <div style={{ position: 'absolute', left: -R * 0.72, top: -R * 0.22, width: R * 1.44, height: R * 0.44, borderRadius: '50%', border: '1px dashed rgba(129,140,248,0.2)' }} />
        {PLATFORMS.map(([slug, glyph], i) => {
          const a = (i / PLATFORMS.length) * Math.PI * 2 + frame * 0.008
          const depth = Math.sin(a)
          const scale = (0.72 + (depth + 1) * 0.22) * appear
          const size = landscape ? 104 : 112
          return (
            <Tile
              key={slug}
              glyph={glyph}
              size={size}
              lit={i === lit && frame >= 30 ? 1 - swap / 15 : 0}
              style={{
                position: 'absolute',
                left: Math.cos(a) * R * appear - size / 2,
                top: depth * R * 0.32 - size / 2,
                transform: `scale(${scale})`,
                zIndex: Math.round((depth + 1) * 100),
                opacity: 0.35 + (depth + 1) * 0.325,
              }}
            />
          )
        })}
        <Mark
          size={landscape ? 200 : 220}
          style={{
            position: 'absolute',
            left: landscape ? -100 : -110,
            top: landscape ? -100 : -110,
            zIndex: 100,
            transform: `scale(${0.6 + appear * 0.4})`,
            filter: 'drop-shadow(0 30px 70px rgba(34,211,238,0.5))',
          }}
        />
      </div>
      <div style={{ position: 'absolute', left: landscape ? 130 : 90, top: landscape ? 330 : 250, width: landscape ? 640 : 900 }}>
        <Words text='Works where you scroll.' from={6} size={heading} accent={['scroll']} />
        <div style={{ height: 40 }} />
        <div style={{ position: 'relative', height: heading * 1.3 }}>
          <div
            style={{
              position: 'absolute',
              fontFamily: FONT,
              fontWeight: 800,
              fontSize: heading * 1.1,
              letterSpacing: -heading * 0.04,
              backgroundImage: GRADIENT,
              WebkitBackgroundClip: 'text',
              color: 'transparent',
              opacity: nameIn * (1 - outro),
              transform: `translateY(${(1 - nameIn) * 40}px)`,
              filter: nameIn < 1 ? `blur(${(1 - nameIn) * 8}px)` : undefined,
            }}
          >
            {current}
          </div>
          <div style={{ position: 'absolute', top: heading * 0.15, opacity: outro, transform: `translateY(${(1 - outro) * 30}px)` }}>
            <Pill size={sub}>14 platforms, one box</Pill>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  )
}

const PROMISES: Array<{ text: string; accent: string }> = [
  { text: 'No login.', accent: 'login' },
  { text: 'No watermark.', accent: 'watermark' },
  { text: 'No limits.', accent: 'limits' },
]

/** Beats 36-42: three hits, three promises. */
export const Promise: React.FC = () => {
  const frame = useCurrentFrame()
  const { landscape, heading } = useLayout()
  const size = heading * (landscape ? 1.45 : 1.25)
  const hit = Math.max(...[0, 60, 120].map((at) => interpolate(frame, [at, at + 2, at + 22], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })))
  return (
    <AbsoluteFill>
      <Backdrop glow={1 + hit * 1.2} seed={5} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: size * 0.18, alignItems: 'flex-start' }}>
          {PROMISES.map((p, i) => {
            const at = i * 60
            const k = ease(frame, at, 16)
            const latest = frame >= at && (i === PROMISES.length - 1 || frame < at + 60)
            const word = p.text.replace(p.accent + '.', '')
            return (
              <div
                key={p.text}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: size * 0.3,
                  opacity: k * (latest ? 1 : 0.4),
                  transform: `scale(${1.25 - k * 0.25})`,
                  transformOrigin: 'left center',
                  filter: k < 1 ? `blur(${(1 - k) * 18}px)` : undefined,
                  fontFamily: FONT,
                  fontWeight: 800,
                  fontSize: size,
                  letterSpacing: -size * 0.045,
                  lineHeight: 1,
                }}
              >
                <svg width={size * 0.62} height={size * 0.62} viewBox='0 0 24 24' fill='none' stroke={C.mint} strokeWidth='3' strokeLinecap='round' strokeLinejoin='round'>
                  <path d='M5 12.5l4.5 4.5L19 7.5' />
                </svg>
                <span style={{ color: C.ink }}>{word}</span>
                <span style={{ marginLeft: -size * 0.04, backgroundImage: GRADIENT, WebkitBackgroundClip: 'text', color: 'transparent', paddingBottom: '0.08em' }}>
                  {p.accent}.
                </span>
              </div>
            )
          })}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'radial-gradient(circle at 50% 50%, rgba(165,243,252,0.35), transparent 60%)', opacity: hit * 0.6 }} />
    </AbsoluteFill>
  )
}

/** Beats 42-52. The site, on both screens, and where to find it. */
export const Outro: React.FC = () => {
  const frame = useCurrentFrame()
  const { landscape, heading, sub } = useLayout()
  const phone = useSpring(4, 90, 18)
  const browser = useSpring(0, 70, 20)
  const url = useSpring(40, 110, 16)
  const end = interpolate(frame, [270, 300], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const float = Math.sin(frame / 40) * 8
  return (
    <AbsoluteFill>
      <Backdrop glow={1.2} seed={6} />
      <AbsoluteFill style={{ perspective: 2400 }}>
        <div
          style={{
            position: 'absolute',
            left: landscape ? 880 : -120,
            top: landscape ? 150 : 1030,
            transform: `translateX(${(1 - browser) * 300}px) rotateY(${landscape ? -24 : 18}deg) rotateX(6deg) scale(${landscape ? 0.95 : 0.85})`,
            opacity: browser * 0.9,
          }}
        >
          <Browser src={shot('home-desktop')} width={960} url={SITE} />
        </div>
        <div
          style={{
            position: 'absolute',
            left: landscape ? 1390 : 560,
            top: landscape ? 200 + float : 940 + float,
            transform: `translateY(${(1 - phone) * 600}px) rotateZ(${landscape ? 4 : 6}deg)`,
          }}
        >
          <Phone src={shot('home-mobile')} width={landscape ? 380 : 440} />
        </div>
      </AbsoluteFill>
      <div style={{ position: 'absolute', left: landscape ? 130 : 90, top: landscape ? 250 : 200, width: landscape ? 760 : 900 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 26, opacity: ease(frame, 0, 20) }}>
          <Mark size={landscape ? 96 : 110} />
          <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: landscape ? 40 : 46, color: C.ink }}>Social Media Downloader</div>
        </div>
        <div style={{ height: 50 }} />
        <Words text='Any video, any app.' from={10} size={heading * 0.82} />
        <Words text='Original quality.' from={22} size={heading * 0.82} accent={['Original', 'quality']} />
        <div style={{ height: 56 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'flex-start' }}>
          <div
            style={{
              opacity: url,
              transform: `translateY(${(1 - url) * 40}px)`,
              padding: 3,
              borderRadius: 26,
              background: GRADIENT,
              boxShadow: '0 0 60px rgba(34,211,238,0.35)',
            }}
          >
            <div style={{ padding: '20px 34px', borderRadius: 23, background: '#0b0d12', fontFamily: FONT, fontWeight: 800, fontSize: sub * 1.35, color: C.ink, letterSpacing: -1 }}>
              {SITE}
            </div>
          </div>
          <div style={{ opacity: ease(frame, 56, 18) }}>
            <Pill size={sub * 0.8} tone='green'>
              Free forever · no account · installs as an app
            </Pill>
          </div>
        </div>
      </div>
      <AbsoluteFill style={{ background: '#000', opacity: end }} />
    </AbsoluteFill>
  )
}
