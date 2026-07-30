import { siteConfig } from '@/config/site'
import { platforms } from '@/lib/platforms'

/**
 * `/llms.txt` — the emerging convention for describing a site to AI agents and
 * LLM-backed crawlers in one flat, cheap-to-read Markdown file.
 *
 * robots.txt already tells those crawlers they may read us (GPTBot,
 * OAI-SearchBot, PerplexityBot, ClaudeBot and friends are explicitly allowed);
 * this tells them what they are looking at without paying to render eleven
 * JavaScript pages and infer it.
 *
 * Generated from the same `platforms` array the pages, sitemap and structured
 * data are built from, so it cannot list a downloader that does not exist or
 * miss one that does. `.tsx` because `pageExtensions` is restricted to tsx —
 * see next.config.ts — and `force-static` so the export writes out/llms.txt at
 * build time and the Worker is never invoked for it.
 */
export const dynamic = 'force-static'

const CAPABILITIES = [
  'Video download — MP4, watermark removed where the source applies one.',
  'Audio extraction — MP3 pulled from the same link, no separate tool.',
  'Image and carousel download — every photo in a post at full resolution.',
  'Batch ZIP — all images from one slideshow as a single archive.',
] as const

const FACTS = [
  'Free, with no account, sign-up, install or download limit.',
  'Runs in the browser; nothing is stored server-side after a download completes.',
  'Paste a post URL on the homepage, or use the dedicated page for a platform.',
  'Accepts several links at once — each resolves independently.',
] as const

function section(title: string, lines: readonly string[]): string {
  return `## ${title}\n\n${lines.join('\n')}\n`
}

function platformLines(): string[] {
  return platforms.map(
    (p) => `- [${p.metaTitle}](${siteConfig.url}/${p.slug}): ${p.tagline}`,
  )
}

function body(): string {
  return [
    `# ${siteConfig.name}`,
    '',
    `> ${siteConfig.description}`,
    '',
    section(
      'What it does',
      CAPABILITIES.map((c) => `- ${c}`),
    ),
    section(
      'Downloaders',
      platformLines(),
    ),
    section('Good to know', FACTS.map((f) => `- ${f}`)),
    section('Links', [
      `- [Homepage](${siteConfig.url}): paste any supported link.`,
      `- [Sitemap](${siteConfig.url}/sitemap.xml): every indexable page.`,
      `- [Source](${siteConfig.links.github}): the code behind this site.`,
      `- [Author](${siteConfig.author.url}): ${siteConfig.author.name}.`,
    ]),
  ].join('\n')
}

export function GET() {
  return new Response(body(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
