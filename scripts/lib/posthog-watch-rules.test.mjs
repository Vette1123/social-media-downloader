import { describe, expect, it } from 'vitest'
import { decideAction, findProblems, issueBody, issueKey } from './posthog-watch-rules.mjs'

const shape = (o) => ({ platform: 'facebook', code: 'inconclusive', host: 'facebook.com', shape: 'www|/share/r/*', n: 10, people: 5, ...o })

describe('findProblems', () => {
  it('flags a supported host routed to generic at a low bar', () => {
    const [p] = findProblems({ shapes: [shape({ platform: 'generic', code: 'unsupported', host: 'google.com', shape: 'www|/*?url', people: 2 })] })
    expect(p.kind).toBe('misroute')
    expect(p.key).toBe('misroute:google.com:www|/*?url')
  })

  it('treats a subdomain of a supported host as supported, an unknown site as not', () => {
    expect(findProblems({ shapes: [shape({ platform: 'generic', host: 'vt.tiktok.com', people: 2 })] })[0].kind).toBe('misroute')
    expect(findProblems({ shapes: [shape({ platform: 'generic', host: 'evil-tiktok.com', people: 9 })] })).toEqual([])
  })

  it('flags a failing shape only with enough people and a non-transient code', () => {
    expect(findProblems({ shapes: [shape({ people: 4 })] })[0].kind).toBe('shape')
    expect(findProblems({ shapes: [shape({ people: 3 })] })).toEqual([])
    expect(findProblems({ shapes: [shape({ code: 'rate_limited', people: 40 })] })).toEqual([])
    expect(findProblems({ shapes: [shape({ code: 'private', people: 40 })] })).toEqual([])
  })

  it('reads Telegram failures as a generic-extractor shape, not a misroute', () => {
    const [p] = findProblems({ shapes: [shape({ platform: 'generic', code: 'upstream', host: 't.me', shape: '|/*/#', people: 5 })] })
    expect(p.kind).toBe('shape')
    expect(findProblems({ shapes: [shape({ platform: 'generic', code: 'unsupported', host: 'example.org', people: 30 })] })).toEqual([])
    // Telegram's own "not shown outside the app / deleted / private channel" is coded unsupported (#87).
    expect(findProblems({ shapes: [shape({ platform: 'generic', code: 'unsupported', host: 't.me', shape: '|/*/#', people: 11 })] })).toEqual([])
  })

  it('flags a platform failure rate only past both bars', () => {
    expect(findProblems({ platforms: [{ platform: 'twitter', ok: 60, bad: 40, bad_people: 6 }] })[0].key).toBe('platform:twitter')
    expect(findProblems({ platforms: [{ platform: 'twitter', ok: 60, bad: 40, bad_people: 2 }] })).toEqual([])
    expect(findProblems({ platforms: [{ platform: 'twitter', ok: 90, bad: 10, bad_people: 9 }] })).toEqual([])
  })

  it('judges MP3 resolves apart from video, so an audio-only collapse is its own issue', () => {
    // 2026-11-19..22: YouTube MP3 went 0 ok / 37 failed while embed-only video "successes"
    // kept the pooled YouTube rate under the bar.
    const out = findProblems({
      platforms: [
        { platform: 'youtube', format: 'video', ok: 359, bad: 0, bad_people: 0 },
        { platform: 'youtube', format: 'audio', ok: 0, bad: 34, bad_people: 7 },
      ],
    })
    expect(out.map((p) => p.key)).toEqual(['platform:youtube:audio'])
    expect(out[0].title).toBe('youtube MP3 resolves fail 100%')
    // A row without a format (older events) keeps the video key, so filed issues still match.
    expect(findProblems({ platforms: [{ platform: 'twitter', ok: 60, bad: 40, bad_people: 6 }] })[0].key).toBe('platform:twitter')
  })

  it('files no MP3 shape issue while that platform has an MP3 outage issue', () => {
    // 2026-11-23: #89 (youtu.be ?si, all 13 audio) was #88's outage seen through one shape.
    const audioShape = { platform: 'youtube', format: 'audio', code: 'inconclusive', host: 'youtu.be', shape: '|/*?si', n: 13, people: 4 }
    const videoShape = { ...audioShape, format: 'video', people: 5 }
    const outage = { platform: 'youtube', format: 'audio', ok: 0, bad: 34, bad_people: 7 }
    const keys = (data) => findProblems(data).map((p) => p.key)
    expect(keys({ shapes: [audioShape, videoShape], platforms: [outage] })).toEqual([
      'platform:youtube:audio',
      'shape:youtube:youtu.be:inconclusive:|/*?si',
    ])
    // No outage on file: the audio shape is its own problem and files as before.
    expect(keys({ shapes: [audioShape] })).toEqual(['shape:youtube:youtu.be:inconclusive:|/*?si'])
  })

  it('flags error kinds and the silence tripwire, ranked by people', () => {
    const out = findProblems({ errors: [{ ev: 'api_error', kind: 'download:image_item', n: 20, people: 5 }], completed24h: 3 })
    expect(out.map((p) => p.kind)).toEqual(['error', 'silence'])
    expect(findProblems({ completed24h: 50 })).toEqual([])
  })
})

describe('issue round trip', () => {
  it('reads back the key it wrote', () => {
    const [p] = findProblems({ shapes: [shape({})] })
    expect(issueKey(issueBody(p))).toBe(p.key)
    expect(issueKey('no marker')).toBeNull()
  })

  it('decides create / update / reopen / skip', () => {
    const start = new Date('2026-11-17T00:00:00Z')
    expect(decideAction(undefined, start)).toBe('create')
    expect(decideAction({ state: 'open' }, start)).toBe('update')
    expect(decideAction({ state: 'closed', state_reason: 'not_planned', closed_at: '2026-01-01' }, start)).toBe('skip')
    expect(decideAction({ state: 'closed', state_reason: 'completed', closed_at: '2026-11-10T00:00:00Z' }, start)).toBe('reopen')
    expect(decideAction({ state: 'closed', state_reason: 'completed', closed_at: '2026-11-18T00:00:00Z' }, start)).toBe('skip')
  })
})
