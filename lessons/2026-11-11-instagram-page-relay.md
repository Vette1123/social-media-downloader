# 2026-11-11 Instagram through the page relay

## What

The live smoke failed Instagram on both passes: production's Cloudflare egress
gets `429` on a reel's crawler view, and the ten-minute cooldown then ended the
chain. A throwaway Deno Playground in the user's Deno Deploy org got `200` and
the full ~809 KB page (`video_versions` present) three times running. So the
existing Deno relay (`reely-resolver-relay`) gained `GET /page`, and the crawler
view now asks it on a 429 and for the rest of the cooldown
(`src/lib/pageRelay.ts`). Signed with Ed25519: the private key is the
`PAGE_RELAY_KEY` Worker secret (`pnpm cf:setup secrets PAGE_RELAY_KEY`, value in
`.env`), the public half is committed in the relay.

## Mistakes

- First plan was to move `deploy/resolver` (Python + yt-dlp) to Deno. Deno
  runs neither; only the HTML was ever refused, the media URLs inside it play
  from anywhere. Relay the page, not the extractor.
- Reached for a shared HMAC secret, then found the relay's existing secret is
  stored only in Cloudflare and Deno, and a new one would have to be typed into
  the Deno console. A public key in the relay's source needs no console at all.

## What worked

- Probing the egress from a Playground before writing either half.
- Keeping the direct request first: two addresses share the load, and the relay
  is only asked when ours is refused.

## Rules

- Relay HTML only, never media: the relay's 100 GiB/month belongs to the player.
- Rotate: new Ed25519 pair, swap `PAGE_PUBLIC_KEY` in the relay's `page.ts`,
  push `PAGE_RELAY_KEY`. Unset, the relay is simply not asked.
