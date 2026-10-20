import { afterEach, describe, expect, it, vi } from 'vitest'

// The webhook's own logic — token gate, secret gate, message shaping, reply
// failure handling — is what this file tests. The resolver chain has its own
// suites; here it is a deterministic stand-in.
vi.mock('./downloader', () => ({
  Downloader: class {
    async downloadVideo(url: string) {
      return {
        id: 'kinetic',
        title: 'A fine catch',
        url,
        thumbnail: '',
        duration: 0,
        author: 'someone',
        description: '',
        downloadUrl: 'https://cdn.example/kinetic.mp4',
        isPhotoCarousel: false,
      }
    }
  },
}))

import { handleTelegram } from './telegram'

type SendHook = (url: string, body: unknown) => void

const sent: Array<{ url: string; body: { [k: string]: unknown } }> = []

function stubFetch(hook?: SendHook): ReturnType<typeof vi.fn> {
  return vi.fn(function stubbed(
    this: unknown,
    input: RequestInfo | URL,
    init?: { body?: string },
  ) {
    const url = String(input)
    const body = init?.body
    if (url.startsWith('https://api.telegram.org/')) {
      const parsed = JSON.parse(body ?? '{}')
      sent.push({ url, body: parsed })
      hook?.(url, parsed)
      return Promise.resolve(new Response('{}', { status: 200 }))
    }
    // The resolve: an og:video page the generic scrape can answer from.
    return Promise.resolve(
      new Response(
        `<html><head><meta property="og:video" content="https://cdn.example/kinetic.mp4"><meta property="og:title" content="A fine catch"></meta><meta property="og:image" content="https://cdn.example/poster.jpg"><meta property="og:description" content="tr"></head><body></body></html>`,
        { status: 200, headers: { 'content-type': 'text/html' } },
      ),
    )
  })
}

function update(text: string): Request {
  return new Request('https://www.socialdownloader.space/api/telegram', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      message: { chat: { id: 9001 }, text, date: Math.floor(Date.now() / 1000) },
    }),
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.TELEGRAM_BOT_TOKEN
  delete process.env.TELEGRAM_WEBHOOK_SECRET
  sent.length = 0
})

describe('the telegram webhook', () => {
  it('answers enabled:false with nothing sent when no token exists', async () => {
    const response = await handleTelegram(update('https://x.example/1'))
    expect(response.status).toBe(200)
    expect(JSON.stringify(await response.json())).toContain('"enabled":false')
    expect(sent).toHaveLength(0)
  })

  it('rejects a delivery whose secret header does not match', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'token-1'
    process.env.TELEGRAM_WEBHOOK_SECRET = 'whisper'
    const response = await handleTelegram(
      new Request('https://www.socialdownloader.space/api/telegram', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-telegram-bot-api-secret-token': 'wrong',
        },
        body: JSON.stringify({ message: { chat: { id: 1 }, text: 'hi' } }),
      }),
    )
    expect(response.status).toBe(401)
    expect(sent).toHaveLength(0)
  })

  it('replies with a save button resolved through the same chain as the site', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'token-1'
    const fetchSpy = stubFetch()
    vi.stubGlobal('fetch', fetchSpy)

    const response = await handleTelegram(update('look at https://www.someblog.example/watch/1 please'))
    expect(response.status).toBe(200)

    const message = sent.find((s) => s.url.includes('/sendMessage'))
    expect(message).toBeTruthy()
    expect(message!.body.chat_id).toBe(9001)
    expect(String(message!.body.text)).toContain('A fine catch')
    const markup = message!.body.reply_markup as {
      inline_keyboard: Array<Array<{ text: string; url: string }>>
    }
    expect(markup.inline_keyboard[0][0].url).toBe(
      'https://www.socialdownloader.space/api/video?url=' +
        encodeURIComponent('https://cdn.example/kinetic.mp4'),
    )
    // The URL the user sent must survive into the reply, so the button is
    // traceable to its source when the message is forwarded.
    expect(String(message!.body.text)).toContain('someblog.example/watch/1')
  }, 15000)

  it('answers a plain greeting with instructions and no resolve', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'token-1'
    const fetchSpy = stubFetch()
    vi.stubGlobal('fetch', fetchSpy)

    await handleTelegram(update('hello'))
    expect(sent).toHaveLength(1)
    expect(String(sent[0].body.text)).toContain('Send me a link')
    // No video resolve happened: nothing fetched beyond the bot API reply.
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('swallows a fetch failure of its own reply rather than wedging the webhook', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'token-1'
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('selection is not open')),
    )
    const response = await handleTelegram(update('hello again'))
    expect(response.status).toBe(200)
  })
})
