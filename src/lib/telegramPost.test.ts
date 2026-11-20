import { describe, expect, it } from "vitest";
import {
  isTelegramChannelLink,
  isTelegramPrivateLink,
  parseTelegramEmbed,
  TELEGRAM_MEDIA_NOT_EMBEDDED,
  TELEGRAM_POST_NOT_FOUND,
  TELEGRAM_POST_TEXT_ONLY,
  telegramEmptyReason,
  telegramPostRef,
} from "./telegramPost";

describe("telegramPostRef", () => {
  it.each([
    ["https://t.me/telegram/300", "telegram", "300"],
    ["https://t.me/s/telegram/300", "telegram", "300"],
    ["https://telegram.me/durov/42?single", "durov", "42"],
    ["t.me/telegram/300".replace(/^/, "https://"), "telegram", "300"],
  ])("reads %s as a public post", (url, channel, id) => {
    expect(telegramPostRef(url)).toEqual({
      channel,
      id,
      embedUrl: `https://t.me/${channel}/${id}?embed=1&mode=tme`,
    });
  });

  it.each([
    "https://t.me/c/1234567890/55", // private chat: no public embed
    "https://t.me/+AbCdEfGh", // invite link
    "https://t.me/joinchat/AbCdEf",
    "https://t.me/SocialDownloaderSpaceBot", // a bot, not a post
    "https://t.me/telegram", // a channel, not a post
    "https://example.com/telegram/300",
    "not a url",
  ])("refuses %s", (url) => {
    expect(telegramPostRef(url)).toBeNull();
  });
});

// Trimmed from the real embed of t.me/telegram/300 and /390 (2026-11-16).
const VIDEO_POST = `<div class="tgme_widget_message_author accent_color"><a class="tgme_widget_message_owner_name" href="https://t.me/telegram"><span dir="auto">Telegram News</span></a></div>
<a class="tgme_widget_message_video_player js-message_video_player" href="https://t.me/telegram/300">
<i class="tgme_widget_message_video_thumb" style="background-image:url('https://cdn1.telesco.pe/file/thumb.jpg')"></i>
<div class="tgme_widget_message_video_wrap"><video src="https://cdn1.telesco.pe/file/f4a2c11d62.mp4?token=abc&amp;x=1" class="tgme_widget_message_video js-message_video" width="100%" height="100%"></video></div></a>
<div class="tgme_widget_message_text js-message_text" dir="auto"><b>Birthdays.</b> You can add your <b>date of birth</b> &amp; more.<br/><br/>April Update</div>`;

const PHOTO_POST = `<a class="tgme_widget_message_photo_wrap 5044125690139619322 1174427031_456241146" href="https://t.me/telegram/390" style="width:800px;background-image:url('https://cdn1.telesco.pe/file/photo1.jpg')"></a>
<a class="tgme_widget_message_photo_wrap 2 3" href="https://t.me/telegram/391" style="width:800px;background-image:url('https://cdn1.telesco.pe/file/photo2.jpg')"></a>`;

describe("parseTelegramEmbed", () => {
  it("finds the clip, its cover, the channel name and the caption", () => {
    expect(parseTelegramEmbed(VIDEO_POST)).toEqual({
      videos: [
        {
          url: "https://cdn1.telesco.pe/file/f4a2c11d62.mp4?token=abc&x=1",
          thumbnail: "https://cdn1.telesco.pe/file/thumb.jpg",
        },
      ],
      photos: [],
      author: "Telegram News",
      text: "Birthdays. You can add your date of birth & more. April Update",
    });
  });

  it("collects every photo of an album", () => {
    const media = parseTelegramEmbed(PHOTO_POST);
    expect(media.videos).toEqual([]);
    expect(media.photos).toEqual([
      "https://cdn1.telesco.pe/file/photo1.jpg",
      "https://cdn1.telesco.pe/file/photo2.jpg",
    ]);
  });

  it("finds nothing on a text-only post", () => {
    expect(
      parseTelegramEmbed(
        '<div class="tgme_widget_message_text js-message_text">hi</div>',
      ),
    ).toMatchObject({
      videos: [],
      photos: [],
    });
  });
});

describe("Telegram link shapes and empty-post reasons", () => {
  const none = { videos: [], photos: [] } as unknown as Parameters<
    typeof telegramEmptyReason
  >[1];

  it("reads the /s/ web-preview forms as the same post", () => {
    expect(telegramPostRef("https://t.me/s/durov/566")?.id).toBe("566");
    expect(telegramPostRef("https://t.me/durov/s/566")?.channel).toBe("durov");
  });

  it("tells a channel and a private group from a post", () => {
    expect(isTelegramChannelLink("https://t.me/durov")).toBe(true);
    expect(isTelegramChannelLink("https://t.me/durov/566")).toBe(false);
    expect(isTelegramPrivateLink("https://t.me/c/1234567890/55")).toBe(true);
    expect(isTelegramPrivateLink("https://t.me/durov/566")).toBe(false);
  });

  it("says why an embed has nothing to download", () => {
    expect(
      telegramEmptyReason('<div class="tgme_widget_message_error">', none),
    ).toBe(TELEGRAM_POST_NOT_FOUND);
    expect(
      telegramEmptyReason('<div class="message_media_not_supported">', none),
    ).toBe(TELEGRAM_MEDIA_NOT_EMBEDDED);
    expect(
      telegramEmptyReason(
        '<div class="tgme_widget_message_bubble">text</div>',
        none,
      ),
    ).toBe(TELEGRAM_POST_TEXT_ONLY);
    expect(telegramEmptyReason("<html></html>", none)).toBeNull();
  });
});
