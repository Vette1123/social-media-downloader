/**
 * Public Telegram channel posts (t.me/<channel>/<id>).
 *
 * Telegram's own embed page (`?embed=1&mode=tme`, what its widget script
 * iframes) carries the media as plain markup: a `<video src>` on its CDN for
 * a clip, a `background-image:url()` on each photo. The CDN answers range
 * requests with real MP4 bytes and no login. The ordinary post page shows only
 * an og:image, which is why the generic page scrape found nothing.
 *
 * Pure parsing, no fetch: downloader.ts does the request. Regexes stay bounded
 * to single tags, per the Worker CPU budget (no DOM parser on the edge).
 * Limits: private chats (t.me/c/…), invite links and bot links have no public
 * embed and are refused up front; a video Telegram marks too large to embed
 * renders without `<video src>`, so it comes back as nothing found.
 */

export interface TelegramPostRef {
  channel: string;
  id: string;
  /** The page Telegram's widget loads; it holds the media URLs. */
  embedUrl: string;
}

const HOSTS = new Set([
  "t.me",
  "www.t.me",
  "telegram.me",
  "www.telegram.me",
  "telegram.dog",
]);

/** Path segments that are Telegram routes, never a channel name. */
const NOT_CHANNELS = new Set([
  "c",
  "joinchat",
  "addstickers",
  "share",
  "proxy",
  "socks",
  "iv",
  "login",
]);

export function telegramPostRef(url: string): TelegramPostRef | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (!HOSTS.has(parsed.hostname.toLowerCase())) return null;
  // t.me/s/<channel>/<id> is the web preview of the same post.
  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts[0] === "s") parts.shift();
  // t.me/<channel>/s/<id> is the same preview with the marker in the wrong
  // place; people paste it (3 fails in 7 days, Nov 2026), so read it too.
  else if (parts[1] === "s") parts.splice(1, 1);
  const [channel, id] = parts;
  if (!channel || !id || !/^\d+$/.test(id)) return null;
  if (
    !/^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(channel) ||
    NOT_CHANNELS.has(channel.toLowerCase())
  )
    return null;
  return {
    channel,
    id,
    embedUrl: `https://t.me/${channel}/${id}?embed=1&mode=tme`,
  };
}

/**
 * A t.me link naming a channel and no post (t.me/<channel>, optionally with
 * `?start=`). There is no file in it; a post is one click in.
 */
export function isTelegramChannelLink(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return false;
  }
  if (!HOSTS.has(parsed.hostname.toLowerCase())) return false;
  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts.length !== 1) return false;
  return (
    /^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(parts[0]) &&
    !NOT_CHANNELS.has(parts[0].toLowerCase()) &&
    parts[0].toLowerCase() !== "s"
  );
}

/** t.me/c/<id>/<post>: a private channel or group, readable only by its members, inside the app. */
export function isTelegramPrivateLink(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return false;
  }
  return (
    HOSTS.has(parsed.hostname.toLowerCase()) &&
    /^\/c\/\d+\/\d+/.test(parsed.pathname)
  );
}

export const TELEGRAM_PRIVATE_CHANNEL =
  "This is a link to a private Telegram channel or group. Its posts open only inside Telegram for members, so they cannot be downloaded here.";

export const TELEGRAM_POST_NOT_FOUND =
  "This Telegram post was not found. It was deleted, or the channel is private, so Telegram shows it only inside the app.";
export const TELEGRAM_POST_TEXT_ONLY =
  "This Telegram post has no video or image to download. It is text only, or a service message.";
export const TELEGRAM_MEDIA_NOT_EMBEDDED =
  "Telegram does not show this post's media outside the app (a video over its embed size limit, or a restricted channel).";

/**
 * Why an embed page with no media has none, in words the visitor can act on, or
 * null when the page is not one we understand (the chain then guesses as before).
 */
export function telegramEmptyReason(
  html: string,
  media: TelegramPostMedia,
): string | null {
  if (media.videos.length > 0 || media.photos.length > 0) return null;
  if (html.includes("tgme_widget_message_error"))
    return TELEGRAM_POST_NOT_FOUND;
  if (
    html.includes("message_media_not_supported") ||
    /tgme_widget_message_(video|roundvideo)_wrap/.test(html)
  ) {
    return TELEGRAM_MEDIA_NOT_EMBEDDED;
  }
  if (html.includes("tgme_widget_message_bubble"))
    return TELEGRAM_POST_TEXT_ONLY;
  return null;
}

export interface TelegramPostMedia {
  videos: { url: string; thumbnail?: string }[];
  photos: string[];
  author?: string;
  text?: string;
}

function decode(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function backgroundUrl(tag: string): string | undefined {
  const m = /background-image:url\('([^']+)'\)/.exec(tag);
  return m ? decode(m[1]) : undefined;
}

export function parseTelegramEmbed(html: string): TelegramPostMedia {
  const thumbs = [
    ...html.matchAll(/<i class="tgme_widget_message_video_thumb"[^>]*>/g),
  ].map((m) => backgroundUrl(m[0]));
  const videos = [...html.matchAll(/<video[^>]*\ssrc="([^"]+)"/g)].map(
    (m, i) => ({
      url: decode(m[1]),
      thumbnail: thumbs[i],
    }),
  );
  const photos = [
    ...html.matchAll(/<a class="tgme_widget_message_photo_wrap[^>]*>/g),
  ]
    .map((m) => backgroundUrl(m[0]))
    .filter((u): u is string => !!u);

  const author =
    /class="tgme_widget_message_owner_name"[^>]*><span[^>]*>([^<]{1,120})</.exec(
      html,
    )?.[1];
  const rawText =
    /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]{0,2000}?)<\/div>/.exec(
      html,
    )?.[1];
  const text = rawText
    ? decode(rawText.replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, ""))
        .replace(/\s+/g, " ")
        .trim()
    : undefined;

  return {
    videos,
    photos,
    author: author ? decode(author).trim() : undefined,
    text: text || undefined,
  };
}
