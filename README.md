# TikTok & Twitter/X Downloader

A web app for downloading TikTok and Twitter/X content without watermarks. Paste a link, get a clean video, audio track, or photo set — no account required.

Built with Next.js 16, TypeScript, and Tailwind CSS.

## Features

**TikTok**

- Download videos without watermarks in HD quality
- Extract audio from any TikTok video (re-served as `audio/mpeg`)
- Download photo carousels — preview all images and save individually or as a ZIP

**Twitter / X**

- Download videos from tweets via vxTwitter and public Cobalt instances

**General**

- Video and image preview before downloading
- Multiple fallback download sources for maximum reliability
- Built-in proxy routes to bypass CORS restrictions
- No registration or API keys required

## Tech Stack

| Layer         | Technology                        |
| ------------- | --------------------------------- |
| Framework     | Next.js 16 (App Router), React 19 |
| Language      | TypeScript                        |
| Styling       | Tailwind CSS 4                    |
| HTTP          | Axios                             |
| HTML Scraping | Cheerio                           |
| ZIP bundling  | JSZip                             |
| Analytics     | Vercel Analytics                  |

## Getting Started

**Prerequisites:** Node.js 18+, pnpm (recommended)

```bash
# Clone and install
git clone https://github.com/Vette1123/tiktok-downloader.git
cd tiktok-downloader
pnpm install

# Start dev server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## How to Use

**Download a video**

1. Copy a TikTok or Twitter/X video URL
2. Paste it into the input on the homepage
3. Click **Process** — the app fetches metadata and a clean download link
4. Optionally preview the video, then click **Download Video** or **Download Audio**

**Download a TikTok photo carousel**

1. Paste the photo post URL
2. All images are extracted and shown as a grid
3. Download images individually or click **Download All as ZIP**

**Supported URL formats**

| Platform  | Formats                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------ |
| TikTok    | `tiktok.com/@user/video/…`, `vm.tiktok.com/…`, `vt.tiktok.com/…`, `m.tiktok.com/v/…`, `tiktok.com/t/…` |
| Twitter/X | `twitter.com/user/status/…`, `x.com/user/status/…`, `t.co/…`                                           |

## Project Structure

```
src/
├── app/
│   ├── page.tsx            # Home page (useReducer-driven UI)
│   ├── layout.tsx          # Root layout with analytics
│   ├── globals.css
│   └── api/
│       ├── download/       # POST — resolves URL, returns video/image data
│       ├── video/          # GET  — proxies video stream (video/mp4)
│       ├── audio/          # GET  — proxies same stream as audio/mpeg
│       └── images/         # POST — batch image fetcher with ZIP support
└── lib/
    ├── downloader.ts       # Core logic: TikTok + Twitter/X, multi-source fallbacks
    ├── validator.ts        # URL validation and platform detection
    ├── appReducer.ts       # Client state management
    ├── audioExtractor.ts   # Audio extraction helpers
    ├── videoProcessor.ts   # Video processing utilities
    └── types.ts            # Shared TypeScript types
```

## API Reference

### `POST /api/download`

Resolves a TikTok or Twitter/X URL and returns download links and metadata.

**Body:**

```json
{ "url": "https://www.tiktok.com/@username/video/1234567890" }
```

**Video response:**

```json
{
  "success": true,
  "downloadUrl": "/api/video?url=...",
  "audioUrl": "/api/audio?url=...",
  "metadata": { "title": "…", "author": "…", "thumbnail": "…" }
}
```

**Photo carousel response:**

```json
{
  "success": true,
  "isPhotoCarousel": true,
  "images": ["https://…", "https://…"],
  "metadata": { "title": "…", "author": "…" }
}
```

### `GET /api/video?url=<encoded>`

Proxies a video file with `Content-Type: video/mp4`, adding the correct `Referer` header for TikTok/Tikwm/Twitter CDNs.

### `GET /api/audio?url=<encoded>`

Same proxy as `/api/video` but with `Content-Type: audio/mpeg`, so browsers treat it as an audio download.

### `POST /api/images`

Fetches a list of image URLs and returns them for individual download or bundled as a ZIP archive.

**Body:**

```json
{ "imageUrls": ["https://…"], "title": "post-title", "asZip": true }
```

## Download Methods

The downloader tries sources in order and falls back on failure:

**TikTok videos:** Snaptik → SSSTik → Tikwm → direct scraping

**Twitter/X videos:** vxTwitter → public Cobalt instances

## Deployment

Deploy to [Vercel](https://vercel.com/new) in one click — no environment variables required for basic use. The project is a standard Next.js app and also works on Netlify, Railway, or any Node.js host.

## Legal Notice

This tool is intended for personal use with content you have the right to download. Respect the Terms of Service of TikTok and Twitter/X, and do not download content without the creator's permission.

## License

MIT — see [LICENSE](LICENSE).

## Issues

Open a ticket on the [Issues](../../issues) page. 2. Create a new issue with detailed information 3. Include error messages and steps to reproduce 4. Mention the type of content (video/image) and TikTok URL format

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) - The React framework for production
- [Tailwind CSS](https://tailwindcss.com/) - For beautiful styling
- [Vercel](https://vercel.com/) - For seamless deployment
- [Cheerio](https://cheerio.js.org/) - Server-side HTML parsing
- Various TikTok download APIs for making this possible

## 📊 Performance Features

- **Gzip Compression**: Reduces response sizes by up to 70%
- **Parallel Processing**: Handle multiple downloads simultaneously
- **Caching**: Smart caching for frequently accessed content
- **Progressive Loading**: Stream large files for better user experience
- **Error Recovery**: Automatic retry with exponential backoff

---

Made with ❤️ for the community
