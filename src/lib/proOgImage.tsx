import { ImageResponse } from 'next/og'
import { PRO_BENEFITS } from '@/config/pro'
import { SUPPORT_PRICES } from '@/config/support'
import {
  BRAND_GRADIENT,
  OgBrand,
  OgChips,
  OgHeadline,
  OgStage,
  ogResponseOptions,
  siteHost,
} from '@/lib/ogKit'

/** The perks the plan card lists, by their titles in config/pro.ts, so a renamed perk fails loudly here. */
const CARD_PERKS = ['The batch queue', 'One-tap ZIP bundles', 'Priority resolving', 'Saves without asking']

export function proCardPerks(): string[] {
  return CARD_PERKS.map((title) => {
    const perk = PRO_BENEFITS.find((b) => b.title === title)
    if (!perk) throw new Error(`Pro card perk "${title}" is not in PRO_BENEFITS`)
    return perk.title
  })
}

function Check() {
  return (
    <div
      style={{
        width: 26,
        height: 26,
        borderRadius: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(45, 212, 191, 0.16)',
        border: '1px solid rgba(94, 234, 212, 0.4)',
      }}
    >
      <svg width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='#5eead4' strokeWidth='3.5' strokeLinecap='round' strokeLinejoin='round'>
        <path d='M5 12.5l4.5 4.5L19 7.5' />
      </svg>
    </div>
  )
}

/** The plan, drawn as the card a buyer would pick: the price is the largest thing on it. */
function PlanCard() {
  return (
    <div
      style={{
        width: 400,
        display: 'flex',
        flexDirection: 'column',
        padding: '30px 32px',
        gap: 22,
        borderRadius: 30,
        background: 'rgba(16, 16, 20, 0.88)',
        border: '1px solid rgba(103, 232, 249, 0.3)',
        boxShadow: '0 40px 90px rgba(0,0,0,0.6), 0 0 80px rgba(34, 211, 238, 0.12), inset 0 1px 0 rgba(255,255,255,0.08)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{
            display: 'flex',
            padding: '6px 16px',
            borderRadius: 999,
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: 3,
            color: '#04171b',
            backgroundImage: BRAND_GRADIENT,
          }}
        >
          PRO
        </div>
        <div style={{ display: 'flex', fontSize: 18, fontWeight: 600, color: 'rgba(250,250,250,0.55)' }}>
          {`or $${SUPPORT_PRICES.lifetime} once`}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <div style={{ display: 'flex', fontSize: 84, fontWeight: 800, letterSpacing: -3, lineHeight: 1 }}>
          {`$${SUPPORT_PRICES.monthly}`}
        </div>
        <div style={{ display: 'flex', fontSize: 24, fontWeight: 600, color: 'rgba(250,250,250,0.6)', paddingBottom: 10 }}>
          / month
        </div>
      </div>
      <div style={{ display: 'flex', height: 1, background: 'rgba(255,255,255,0.1)' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {proCardPerks().map((perk) => (
          <div key={perk} style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 22, fontWeight: 600 }}>
            <Check />
            {perk}
          </div>
        ))}
      </div>
    </div>
  )
}

export function proOgCard() {
  return (
    <OgStage glow='99, 102, 241'>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <OgBrand />
      </div>

      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, width: 590 }}>
          <OgHeadline parts={['Twenty links in.', 'One ZIP out.']} size={66} />
          <div style={{ display: 'flex', fontSize: 25, lineHeight: 1.4, color: 'rgba(250, 250, 250, 0.62)' }}>
            {`Batch downloads, priority resolving and no sponsor card. $${SUPPORT_PRICES.yearly} a year.`}
          </div>
        </div>
        <PlanCard />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <OgChips labels={['Playlist import', 'Tagged MP3s', 'Every device']} />
        <div style={{ display: 'flex', fontSize: 20, fontWeight: 600, color: 'rgba(250, 250, 250, 0.5)' }}>
          {`${siteHost}/pro`}
        </div>
      </div>
    </OgStage>
  )
}

export function renderProOgImage() {
  return new ImageResponse(proOgCard(), ogResponseOptions())
}
