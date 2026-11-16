/**
 * Every word the Telegram bot says, in the site's five languages.
 *
 * One source for two readers: `telegram.ts` (replies, in the Worker) and
 * `scripts/telegram-setup.mjs` (the bot's public profile, which Node imports
 * straight from this .ts file). So this module imports nothing at runtime.
 *
 * Telegram's own search ranks bots by the words in the name and the
 * descriptions, so those carry the queries people type ("video downloader",
 * "تحميل فيديو", "baixar vídeo"), and the limits below are Telegram's.
 */
import type { Locale } from './i18n'

export const BOT_NAME_MAX = 64
export const BOT_SHORT_DESCRIPTION_MAX = 120
export const BOT_DESCRIPTION_MAX = 512

export interface BotCopy {
  /** Profile name: what Telegram search matches first. */
  name: string
  /** "About": on the profile and in every shared link to the bot. */
  shortDescription: string
  /** "What can this bot do?": the empty chat's first screen. */
  description: string
  commands: { start: string; help: string }
  greeting: (site: string) => string
  help: (site: string) => string
  saveButton: string
  couldNotRead: string
  nothingToHandOver: string
}

const PLATFORMS = 'TikTok, Instagram, YouTube, X (Twitter), Facebook, Reddit, Pinterest, Threads, Vimeo, Snapchat, Twitch'

export const BOT_COPY: Record<Locale, BotCopy> = {
  en: {
    name: 'Video Downloader: TikTok, Instagram, YouTube, X',
    shortDescription: 'Send a TikTok, Instagram, YouTube, X or Facebook link, get the video. Free, no sign-up, no watermark.',
    description: `Free video downloader for Telegram. Send a link from ${PLATFORMS} or any public video page, and get the video back with a download button.\n\nNo sign-up, no app, no watermark on TikTok. Reels, Shorts, tweets and Threads posts work too.\n\nPublic posts only. Prefer the browser? socialdownloader.space`,
    commands: { start: 'How to download a video', help: 'Which links work' },
    greeting: (site) =>
      `Send me a link — TikTok, Instagram, YouTube, X, Facebook, Reddit, Pinterest, Threads or any video page — and I answer with a download button.\n\nPublic posts only. In the browser: ${site}`,
    help: (site) =>
      `<b>Works with</b>\n${PLATFORMS}, and most public video pages.\n\n<b>How</b>\nCopy the post's link in the app (Share → Copy link) and paste it here.\n\n<b>Won't work</b>\nPrivate accounts, age-restricted posts, and anything behind a login.\n\nPhotos, MP3 and subtitles: ${site}`,
    saveButton: 'Save the video',
    couldNotRead: 'Could not read that link:',
    nothingToHandOver: 'That link resolved, but yielded nothing I can hand over:',
  },
  es: {
    name: 'Descargar Videos: TikTok, Instagram, YouTube, X',
    shortDescription: 'Envía un enlace de TikTok, Instagram, YouTube, X o Facebook y recibe el video. Gratis, sin registro.',
    description: `Descargador de videos gratis en Telegram. Envía un enlace de ${PLATFORMS} o de cualquier página de video pública y recibe el video con un botón de descarga.\n\nSin registro, sin app, TikTok sin marca de agua. También Reels, Shorts, tuits y Threads.\n\nSolo publicaciones públicas. ¿Prefieres el navegador? socialdownloader.space`,
    commands: { start: 'Cómo descargar un video', help: 'Qué enlaces funcionan' },
    greeting: (site) =>
      `Envíame un enlace — TikTok, Instagram, YouTube, X, Facebook, Reddit, Pinterest, Threads o cualquier página de video — y te respondo con un botón de descarga.\n\nSolo publicaciones públicas. En el navegador: ${site}`,
    help: (site) =>
      `<b>Funciona con</b>\n${PLATFORMS} y la mayoría de páginas de video públicas.\n\n<b>Cómo</b>\nCopia el enlace en la app (Compartir → Copiar enlace) y pégalo aquí.\n\n<b>No funciona</b>\nCuentas privadas, contenido con restricción de edad y todo lo que pide iniciar sesión.\n\nFotos, MP3 y subtítulos: ${site}`,
    saveButton: 'Guardar el video',
    couldNotRead: 'No pude leer ese enlace:',
    nothingToHandOver: 'El enlace funcionó, pero no hay nada que pueda enviarte:',
  },
  pt: {
    name: 'Baixar Vídeos: TikTok, Instagram, YouTube, X',
    shortDescription: 'Mande um link do TikTok, Instagram, YouTube, X ou Facebook e receba o vídeo. Grátis, sem cadastro.',
    description: `Baixador de vídeos grátis no Telegram. Mande um link do ${PLATFORMS} ou de qualquer página de vídeo pública e receba o vídeo com um botão de download.\n\nSem cadastro, sem app, TikTok sem marca d'água. Reels, Shorts, tweets e Threads também.\n\nSó posts públicos. Prefere o navegador? socialdownloader.space`,
    commands: { start: 'Como baixar um vídeo', help: 'Quais links funcionam' },
    greeting: (site) =>
      `Me mande um link — TikTok, Instagram, YouTube, X, Facebook, Reddit, Pinterest, Threads ou qualquer página de vídeo — e eu respondo com um botão de download.\n\nSó posts públicos. No navegador: ${site}`,
    help: (site) =>
      `<b>Funciona com</b>\n${PLATFORMS} e a maioria das páginas de vídeo públicas.\n\n<b>Como</b>\nCopie o link no app (Compartilhar → Copiar link) e cole aqui.\n\n<b>Não funciona</b>\nContas privadas, conteúdo com restrição de idade e o que exige login.\n\nFotos, MP3 e legendas: ${site}`,
    saveButton: 'Salvar o vídeo',
    couldNotRead: 'Não consegui ler esse link:',
    nothingToHandOver: 'O link funcionou, mas não há nada que eu possa enviar:',
  },
  id: {
    name: 'Download Video: TikTok, Instagram, YouTube, X',
    shortDescription: 'Kirim link TikTok, Instagram, YouTube, X atau Facebook, dapatkan videonya. Gratis, tanpa daftar.',
    description: `Pengunduh video gratis di Telegram. Kirim link dari ${PLATFORMS} atau halaman video publik mana pun, lalu dapatkan videonya dengan tombol unduh.\n\nTanpa daftar, tanpa aplikasi, TikTok tanpa watermark. Reels, Shorts, tweet dan Threads juga bisa.\n\nHanya postingan publik. Lebih suka browser? socialdownloader.space`,
    commands: { start: 'Cara mengunduh video', help: 'Link apa saja yang bisa' },
    greeting: (site) =>
      `Kirim link — TikTok, Instagram, YouTube, X, Facebook, Reddit, Pinterest, Threads atau halaman video apa pun — dan saya balas dengan tombol unduh.\n\nHanya postingan publik. Lewat browser: ${site}`,
    help: (site) =>
      `<b>Bisa untuk</b>\n${PLATFORMS}, dan sebagian besar halaman video publik.\n\n<b>Caranya</b>\nSalin link postingan di aplikasi (Bagikan → Salin link) lalu tempel di sini.\n\n<b>Tidak bisa</b>\nAkun privat, konten dengan batasan usia, dan apa pun yang perlu login.\n\nFoto, MP3 dan subtitle: ${site}`,
    saveButton: 'Simpan video',
    couldNotRead: 'Link itu tidak bisa dibaca:',
    nothingToHandOver: 'Link berhasil dibuka, tapi tidak ada yang bisa saya kirim:',
  },
  ar: {
    name: 'تحميل فيديو: تيك توك، إنستغرام، يوتيوب، X',
    shortDescription: 'أرسل رابط تيك توك أو إنستغرام أو يوتيوب أو X أو فيسبوك واحصل على الفيديو. مجاناً وبدون تسجيل.',
    description: `أداة مجانية لتحميل الفيديو على تيليجرام. أرسل رابطاً من تيك توك أو إنستغرام أو يوتيوب أو X (تويتر) أو فيسبوك أو ريديت أو بنترست أو ثريدز أو أي صفحة فيديو عامة، وسيصلك الفيديو مع زر تحميل.\n\nبدون تسجيل وبدون تطبيق، وتيك توك بدون علامة مائية. الريلز والشورتس والتغريدات أيضاً.\n\nالمنشورات العامة فقط. تفضّل المتصفح؟ socialdownloader.space`,
    commands: { start: 'طريقة تحميل فيديو', help: 'الروابط المدعومة' },
    greeting: (site) =>
      `أرسل لي رابطاً من تيك توك أو إنستغرام أو يوتيوب أو X أو فيسبوك أو ريديت أو بنترست أو ثريدز أو أي صفحة فيديو، وسأرد عليك بزر تحميل.\n\nالمنشورات العامة فقط. من المتصفح: ${site}`,
    help: (site) =>
      `<b>يعمل مع</b>\n${PLATFORMS}، ومعظم صفحات الفيديو العامة.\n\n<b>الطريقة</b>\nانسخ رابط المنشور من التطبيق (مشاركة ← نسخ الرابط) والصقه هنا.\n\n<b>لا يعمل مع</b>\nالحسابات الخاصة والمحتوى المقيّد بالعمر وأي شيء يتطلب تسجيل الدخول.\n\nالصور وMP3 والترجمات: ${site}`,
    saveButton: 'حفظ الفيديو',
    couldNotRead: 'تعذّرت قراءة هذا الرابط:',
    nothingToHandOver: 'فُتح الرابط، لكن لا يوجد ما يمكنني إرساله:',
  },
}

/** Telegram sends `en`, `pt-br`, `ar`…; anything the site does not speak is English. */
export function botCopyFor(languageCode: string | undefined): BotCopy {
  const base = (languageCode ?? '').toLowerCase().split('-')[0]
  return base in BOT_COPY ? BOT_COPY[base as Locale] : BOT_COPY.en
}
