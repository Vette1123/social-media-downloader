/**
 * Telegram bot webhook.
 *
 * Telegram sends the update; we resolve the link exactly as the web app would
 * (the same Downloader) and reply with a download button. No token configured
 * ⇒ the webhook stays enabled:false and answers 200 on everything, which is
 * what Telegram wants: a non-2xx makes it retry the delivery forever.
 *
 * Operation once a token exists (all inputs, nothing in code):
 *   wrangler secret put TELEGRAM_BOT_TOKEN
 *   wrangler secret put TELEGRAM_WEBHOOK_SECRET          # any random string
 *   curl "https://api.telegram.org/bot<token>/setWebhook?url=https://www.socialdownloader.space/api/telegram&secret_token=<the same string>"
 *
 * Every reply is sent by calling the bot API — so the handler itself is
 * stateless and the only fetches it makes are the ones it answers with.
 */

import { Downloader } from './downloader'
import type { VideoData } from './types'
import { directSaveUrl } from './directSave'

const MAX_TITLE = 64

function botToken(): string {
  return process.env.TELEGRAM_BOT_TOKEN ?? ''
}

/** Telegram ratings of its own secret header; present only when the webhook
 * was registered with `secret_token`. */
function webhookAuthorized(request: Request): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret) return true
  return request.headers.get('x-telegram-bot-api-secret-token') === secret
}

/** A link whose bytes the bot can hand over: direct when it saves as an
 * attachment from any client, else the same-origin video proxy. */
function botFileUrl(origin: string, videoData: VideoData): string | null {
  const direct = directSaveUrl(videoData)
  if (direct) return new URL(direct, origin).toString()
  if (videoData.downloadUrl)
    return new URL(
      `/api/video?url=${encodeURIComponent(videoData.downloadUrl)}`,
      origin,
    ).toString()
  return null
}

export function telegramEnabled(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN)
}

function titleOf(raw: unknown): string {
  const title =
    typeof raw === 'string' && raw.trim() ? raw.trim() : 'Download ready'
  return title.length > MAX_TITLE ? `${title.slice(0, MAX_TITLE - 1)}…` : title
}

function shortError(e: unknown): string {
  const message = (e as Error)?.message ?? 'unknown failure'
  return message.length > 160 ? `${message.slice(0, 159)}…` : message
}

function extractFirstUrl(text: string): string | null {
  return /\bhttps?:\/\/\S+/.exec(text)?.[0] ?? null
}

async function sendMessage(
  chatId: number,
  text: string,
  fileUrl?: string,
): Promise<void> {
  await fetch(`https://api.telegram.org/bot${botToken()}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...(fileUrl
        ? {
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Save the video', url: fileUrl }],
              ],
            },
          }
        : {}),
    }),
  }).catch(() => {
    // Telegram will not retry a 200; a lost reply beats a wedged webhook.
  })
}

export async function handleTelegram(request: Request): Promise<Response> {
  if (!telegramEnabled())
    return Response.json({ enabled: false, ok: true })
  if (!webhookAuthorized(request)) return new Response(null, { status: 401 })

  const update = (await request.json().catch(() => null)) as
    | { message?: { chat?: { id?: number }; text?: string } }
    | null
  const chatId = update?.message?.chat?.id
  const text = (update?.message?.text ?? '').trim()
  if (typeof chatId !== 'number') return Response.json({ ok: true })

  const link = extractFirstUrl(text)
  if (!link) {
    await sendMessage(
      chatId,
      'Send me a link — TikTok, Instagram, YouTube, Reddit, Twitch, Pinterest or any video page — and I answer with a download button.',
    )
    return Response.json({ ok: true })
  }

  try {
    const videoData = await new Downloader().downloadVideo(link)
    const fileUrl = botFileUrl(new URL(request.url).origin, videoData)
    if (!fileUrl) {
      await sendMessage(
        chatId,
        `That link resolved, but yielded nothing I can hand over:\n<b>${titleOf(videoData.title)}</b>`,
      )
      return Response.json({ ok: true })
    }
    await sendMessage(
      chatId,
      `<b>${titleOf(videoData.title)}</b>${videoData.author ? `\n<i>${videoData.author}</i>` : ''}\n${link}`,
      fileUrl,
    )
  } catch (e) {
    await sendMessage(chatId, `Could not read that link: ${shortError(e)}`)
  }
  return Response.json({ ok: true })
}

export function telegramHealth(): { enabled: boolean } {
  return { enabled: telegramEnabled() }
}
