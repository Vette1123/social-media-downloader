/**
 * "Recently added" — a short, dated list of what shipped lately.
 *
 * Its job is conversion-adjacent trust: a visitor deciding whether this tool
 * is alive reads four concrete lines and answers the question themselves. It
 * lives in config (not CMS, not fetch) because it changes a few times a month
 * and every entry must be true of the deployed site on the day it appears.
 *
 * Newest first. Four entries maximum — a changelog that scrolls stops being
 * read. When an entry is older than the next one's news, delete rather than
 * accumulate.
 */

export interface WhatsNewItem {
  /** Shown as-is; keep to a short month + day form ("Aug 24"). */
  date: string
  title: string
  detail: string
}

export const WHATS_NEW: WhatsNewItem[] = [
  {
    date: 'Nov 16',
    title: 'A Telegram bot',
    detail:
      'Send a link to @SocialDownloaderSpaceBot and the video comes back in the chat, in your language.',
  },
  {
    date: 'Nov 16',
    title: 'Threads share links',
    detail:
      'Links copied from the Threads app download, and so do photo-only posts.',
  },
  {
    date: 'Nov 13',
    title: 'Download buttons first',
    detail:
      'A result opens on its download controls, and progress reads in one status line instead of a banner.',
  },
  {
    date: 'Oct 31',
    title: 'Every page in your language',
    detail:
      'Spanish, Portuguese, Indonesian and Arabic (RTL) across every page and message. Pick one from the footer.',
  },
]
