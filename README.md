# Social Media Downloader

A free, watermark-free downloader for TikTok and Twitter/X. Paste a link and get an HD video, MP3 audio, a TikTok photo carousel (individual images or a ZIP), or a fully rendered slideshow MP4 with the original soundtrack — no login, no install, runs in your browser.

Live: <https://www.mohamedgado.com>

Built with Next.js 16, React 19, TypeScript, Tailwind CSS 4, and Motion.

## Features

**TikTok**

- HD video downloads without the watermark
- Extract the soundtrack as MP3 (re-served with `audio/mpeg`)
- Photo carousels (slideshows): preview every image, save individually or as a ZIP, keep the original background music
- Render a TikTok slideshow into a real MP4 video (ffmpeg) when the platform only ships images

**Twitter / X**

- Native video extraction from any `twitter.com` or `x.com` status URL

**Quality of life**

- Inline video and image previews before downloading
- Multi-source fallback chain per platform (resilient against any single provider going down)
- CORS-proxied media routes so downloads work cross-origin
- Inline URL validation, smooth motion animations, fully responsive layout
- Production-grade SEO: dynamic OpenGraph and Twitter card images, JSON-LD (WebSite, Person, SoftwareApplication, HowTo, FAQPage), hreflang, sitemap, and a manifest tuned for PWA install
- No registration, no API keys, no daily limit

## Tech stack

| Layer            | Technology                          |
| ---------------- | ----------------------------------- |
| Framework        | Next.js 16 (App Router), React 19   |
| Language         | TypeScript 6                        |
| Styling          | Tailwind CSS 4                      |
| Animation        | Motion (formerly framer-motion) 12  |
| HTTP             | Axios                               |
| HTML scraping    | Cheerio                             |
| ZIP bundling     | JSZip                               |
| Slideshow video  | fluent-ffmpeg + @ffmpeg-installer   |
| Dynamic OG       | @vercel/og (edge runtime)           |
| Analytics        | Vercel Analytics                    |

## Getting started

**Prerequisites:** Node.js 20+ (24 LTS recommended), pnpm.

```bash
git clone https://github.com/Vette1123/tiktok-downloader.git
cd tiktok-downloader
pnpm install
pnpm dev
```

Open <http://localhost:3000>.

Build for production:

```bash
pnpm build && pnpm start
```

## How to use

**Download a video**

1. Copy a TikTok or Twitter/X video URL.
2. Paste it into the input on the homepage.
3. Click **Process URL** — the app fetches metadata and a clean download link.
4. Optionally preview, then click **Video** or **Extract Audio**.

**Download a TikTok photo carousel**

1. Paste the photo post URL.
2. All images appear as a selectable grid.
3. Toggle the selections, then download them individually or as a ZIP.
4. Click **Video (slideshow)** to render an MP4 of the images timed to the original music.

**Supported URL formats**

| Platform  | Formats                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------ |
| TikTok    | `tiktok.com/@user/video/…`, `vm.tiktok.com/…`, `vt.tiktok.com/…`, `m.tiktok.com/v/…`, `tiktok.com/t/…` |
| Twitter/X | `twitter.com/user/status/…`, `x.com/user/status/…`, `t.co/…`                                           |

## Project structure

```
src/
├── app/
│   ├── page.tsx                 # Home page (useReducer + motion)
│   ├── layout.tsx               # Root layout, metadata, JSON-LD injection
│   ├── opengraph-image.tsx      # Dynamic 1200x630 OG image (edge runtime)
│   ├── twitter-image.tsx        # Twitter card image (delegates to OG)
│   ├── robots.ts                # robots.txt (incl. AI crawler policy)
│   ├── sitemap.ts               # sitemap.xml with hreflang + OG image
│   ├── globals.css
│   └── api/
│       ├── download/            # POST — resolves URL, returns video/image data
│       ├── video/               # GET  — proxies the video stream (video/mp4)
│       ├── audio/               # GET  — proxies the same stream as audio/mpeg
│       ├── images/              # POST — batch image fetcher with ZIP support
│       └── slideshow/           # POST — renders an MP4 from images + audio (ffmpeg)
├── components/
│   ├── icons.tsx
│   ├── ImageLightbox.tsx
│   └── ui/accordion.tsx
├── config/
│   └── site.ts                  # Single source of truth for site metadata
└── lib/
    ├── downloader.ts            # Core logic: TikTok + Twitter/X multi-source fallbacks
    ├── validator.ts             # URL validation and platform detection
    ├── appReducer.ts            # Client state machine
    ├── audioExtractor.ts        # Audio extraction helpers
    ├── videoProcessor.ts        # Video processing utilities
    ├── structuredData.ts        # JSON-LD graph (Schema.org)
    ├── types.ts                 # Shared TypeScript types
    └── utils.ts
```

## API reference

### `POST /api/download`

Resolves a TikTok or Twitter/X URL and returns download links and metadata.

```json
{ "url": "https://www.tiktok.com/@username/video/1234567890" }
```

Video response:

```json
{
  "success": true,
  "downloadUrl": "/api/video?url=...",
  "audioUrl": "/api/audio?url=...",
  "metadata": { "title": "…", "author": "…", "thumbnail": "…" }
}
```

Photo carousel response:

```json
{
  "success": true,
  "isPhotoCarousel": true,
  "images": ["https://…", "https://…"],
  "metadata": { "title": "…", "author": "…" }
}
```

### `GET /api/video?url=<encoded>`

Proxies a video file with `Content-Type: video/mp4`, adding the correct `Referer` for TikTok / Tikwm / Twitter CDNs and honoring HTTP range requests so preview/seek works.

### `GET /api/audio?url=<encoded>`

Same proxy as `/api/video` but with `Content-Type: audio/mpeg`, so browsers treat it as an audio download.

### `POST /api/images`

Fetches a list of image URLs. Returns either a JSON list of downloadable URLs or a ZIP archive depending on `asZip`.

```json
{ "imageUrls": ["https://…"], "title": "post-title", "asZip": true }
```

### `POST /api/slideshow`

Renders a real MP4 from a TikTok photo carousel using ffmpeg, timing each image and laying the original music on top.

```json
{
  "imageUrls": ["https://…", "https://…"],
  "audioUrl": "https://…",
  "perImageSeconds": 3
}
```

## Source fallback order

The downloader tries providers in order and falls back automatically on failure.

- **TikTok videos:** Snaptik → SSSTik → Tikwm → direct scraping
- **Twitter/X videos:** vxTwitter → public Cobalt instances

## Deployment

The project deploys to [Vercel](https://vercel.com/new) with no configuration. It runs on any Node.js host that supports Next.js 16 (Node 20+, ideally 24 LTS).

`@vercel/og` requires the edge runtime; the OG and Twitter card routes are already configured for it.

## Legal

This tool is intended for personal use with content you have the right to save. Respect the Terms of Service of TikTok and Twitter/X, and do not download content without the creator's permission.

## License

MIT — see [LICENSE](LICENSE).

## Issues and contributions

Open a ticket on the [Issues](../../issues) page with a description, the URL format you tried, and any error message. Pull requests welcome.
