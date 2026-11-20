# Promo films

Two cuts of one 26-second film about Social Media Downloader, rendered with
[Remotion](https://www.remotion.dev) at 60 fps:

| Cut | Size | File |
| --- | --- | --- |
| `Film` | 1920×1080, 16:9 | `out/smd-film-1080p60.mp4` |
| `Reel` | 1080×1920, 9:16 | `out/smd-reel-9x16-60.mp4` |

The published copies live in `docs/films/`. This folder is its own package with its own
dependencies: the site never installs or bundles any of it.

## Make it

```bash
cd video
pnpm install --ignore-workspace
pnpm capture        # real screens of the live site -> public/shots/
pnpm beat           # the soundtrack -> public/audio/beat-smd.wav
pnpm studio         # scrub and edit in the browser
pnpm build          # render both cuts, then assert fps, frames and size with ffprobe
```

`pnpm build Reel` renders one cut. Copy a finished cut to `docs/films/` to publish it.

## How it is put together

- **The cut follows the soundtrack.** 120 BPM at 60 fps is 30 frames a beat, and every
  scene starts on a beat (`src/timing.ts`): the drop on beat 6, the three promises on beats
  36, 38 and 40, the outro on 42. Change the beat and the timing together.
- **The screens are the shipped site.** `tools/capture.mjs` drives headless Chrome over
  the DevTools protocol against socialdownloader.space, pastes a public Telegram post and
  waits for the real result. Nothing in the film is a mock-up of the UI.
- **The brand comes from the app.** The mark and the platform glyphs are imported from
  `src/lib/brandMark.ts` and `src/lib/ogGlyphs.ts`, the same source as the favicon and
  the share cards, so a new icon reaches the film with a re-render.
- **Grain and drifting glows are there for the encoder.** A still, dark gradient bands
  as soon as H.264 quantises it.
