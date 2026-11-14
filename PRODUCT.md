# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A person on a phone who has just seen a post in TikTok, Instagram, X, YouTube or another app and wants that one
file (video, audio or images) on their device, then leaves. They arrive by pasting a link, through the installed
PWA's share target, or from a search page for their platform. Many browse in Spanish, Portuguese, Indonesian or
Arabic. Repeat use (Recent list, batch paste, installed app) exists but is secondary to the one-off save.

## Product Purpose

Paste a public link, get the original file saved to the device. Success is the file on the device in the fewest
presses, with nothing between the visitor and the Download button. The site is a free tool; the owner's own apps
(Masareef, Rafiq) and GitHub Sponsors are how it is supported.

## Positioning

- Free, no login, no limits: downloading never needs an account or a payment. Pro and Sponsors add extras;
  they never widen what can be reached.
- No popups, no redirects, no ad networks or ad scripts. Promotions are the owner's own apps, labelled "Our app",
  the Sponsors link, and at most one paid card under a finished download, labelled "Sponsored", served from our
  own site, hidden from Pro, and ending itself on its paid-up date (`until` in `src/config/offers.ts`).

## Operating Context

- Mostly mobile browsers, including low-power phones and iOS Safari (no direct file save; a hint explains it).
- Entry points: the home paste box, platform landing pages (`/tiktok-downloader`, …), `/?url=` share-sheet
  arrivals, and the PWA share target.
- Hosted on Cloudflare Workers (free tier CPU budget); media bytes should not stream through the Worker.

## Capabilities and Constraints

- Platforms: TikTok, X, Instagram, Facebook, YouTube, Pinterest, Reddit, Threads, Snapchat, Twitch, Vimeo, Dailymotion, LinkedIn, plus
  generic pages that publish their media. Reach is limited to what a logged-out visitor can see: no private,
  paywalled or DRM content.
- Outputs: original-quality video with SD fallback, MP3 audio, image carousels (single or ZIP), rendered
  slideshow MP4.
- YouTube video is currently unobtainable from the production address; audio and subtitles work.
- Optional Google sign-in syncs preferences and attaches supporter extras. Recent history stays in the browser.
- Open source (MIT).

## Brand Commitments

- Name: Social Media Downloader, at socialdownloader.space.
- Voice: plain, short, literal ("Saves straight to your device"). No sales language.

## Evidence on Hand

- PostHog project 327739 (anonymous product analytics, dead/rage clicks, download outcomes).
- `docs/social-preview.png`, app screenshots under `src/app/screenshots`.
- No testimonials, user counts or press exist; do not invent them.

## Product Principles

1. The Download button and the result are the page. Nothing pushes them down or out of the first screen.
2. The page never moves under the visitor: status lives in fixed slots, not banners that appear and vanish.
3. Every control answers the press it receives, including the ones visitors press "wrongly".
4. Promotions are ours, labelled, and never block or delay a save.
5. Every locale gets the same experience, Arabic RTL included.

## Accessibility & Inclusion

Current practice is the bar: WCAG 2.2 AA intent, full RTL for Arabic, five locales (en, es, pt, id, ar),
keyboard use and screen-reader live regions for status, reduced motion respected, and expensive effects
frozen on touch and low-power devices.
