# Promo films (Remotion, 60 fps)

## What

A 26-second film about the app in two cuts, 1920×1080 and 1080×1920, both 60 fps, in a
self-contained `video/` package (its own deps, excluded from the site's tsconfig and eslint).
Published to `docs/films/` and linked from the README with a poster frame. Seven scenes on a
120 BPM grid (30 frames a beat): hook, drop on the mark, paste, the real result, the platform
orbit, three promises, outro.

## Mistakes

- First idea was a GIF. A GIF is 256 colours at a low frame rate; the user wanted a film.
  The README now links an MP4 behind a poster image instead.
- `remotion.config.ts` listed the local Chrome as `'C:\Program Files\…'`. In a JS string
  `\P` is just `P`, so the path never existed and every render quietly used Remotion's own
  downloaded headless shell. Renders worked, so nothing flagged it; reading the file did.
- Stills caught four text orphans ("10 / more.", "keep / it.", "any / app.") the code
  could not show. Every scene got a still at a key frame before the full render.
- The capture's mobile result shot never fired: Enter does not submit in the mobile layout.
  Dropped rather than faked.

## What worked

- Real screens of the live site, captured with headless Chrome over CDP (`pnpm capture`),
  pasting a public Telegram post and waiting for the real result. No mocked-up UI.
- The mark and the platform glyphs imported from `src/lib/brandMark.ts` and `src/lib/ogGlyphs.ts`,
  so the film can't drift from the favicon and the share cards.
- Integer frames per beat (60 fps × 120 BPM) put every cut and slam on the soundtrack exactly.
- `pnpm build` asserts the output with ffprobe: 60 fps, 1560 frames, the right size.
- Grain plus drifting glows keep dark gradients from banding under H.264; PNG frames, CRF 16.

## Rules

- A film is checked as stills at its key frames before the full render, in both aspect ratios.
- A render script asserts fps, frame count and size from the file, not from the config.
- Windows paths in JS config use forward slashes.
