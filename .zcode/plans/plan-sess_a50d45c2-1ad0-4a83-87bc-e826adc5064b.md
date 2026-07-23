## Push Lighthouse from 94 → higher (LCP-focused)

**Current bottleneck:** Score is capped at 94 by **LCP = 3.1s (score 76)**. FCP, TBT, Speed Index are all already 100. LCP element is the `<h1>` headline ("Download any video, watermark-free"). The delay breaks down as: **render-blocking CSS (158ms) + full-page React hydration (3.5s bootup, dominated by Rendering + Style&Layout = 2.5s) + the gradient-text animation repainting the exact LCP element.**

These optimizations target the LCP chain while preserving every visual effect.

### 1. Shrink the client boundary (biggest lever — reduces hydration + flight data)
`GlowCard` is `'use client'` and **wraps the entire hero** — the static icon row, headline, reassurance chips, and dev links all get serialized into RSC flight data (56KB) and hydrated, just so the card can track the cursor. 
- Make `GlowCard` a **server component (plain `<div>`)** and move its pointer-spotlight logic into the `InteractiveBackground`-style pattern OR a tiny isolated client island. The static children (icon row, h1, chips, links) then stay pure server-rendered HTML — no hydration cost, flight data shrinks.
- The `DownloaderApp` stays client (it's genuinely interactive) — that's the only thing that needs to hydrate in the hero.
- *Result: removes the largest chunk of unnecessary hydration work, directly cutting the Rendering/Style&Layout main-thread time that delays LCP.*

### 2. Drop Geist_Mono font (confirmed with you)
Used in only 2 spots (11px muted URL-format lists). Removing `Geist_Mono` from `layout.tsx`, dropping the `--font-geist-mono` variable from `<body>`, and letting `font-mono` fall back to the system monospace stack eliminates a whole font family's subset files (6 woff2 files, ~76KB) from being available/loaded. The lists look near-identical at that size.

### 3. Stop the gradient animation from repainting the LCP element
The `<span class="text-grad">` inside the `<h1>` runs a 14s `background-position` animation that **continuously repaints the exact LCP element** during the critical measurement window. 
- Freeze the animation by default (static gradient still looks premium), OR gate the live sweep to capable pointer devices only (it's already frozen on mobile/low-power). Keeps the gradient look everywhere, removes the continuous repaint on the LCP text.

### 4. Preload hint tuning / fetchpriority on the LCP font
The font preload is already correct (variable Geist latin covers weight 800). I'll verify the preload keeps `crossOrigin` and add nothing wasteful — no change needed unless measurement shows otherwise. *(If the CSS render-blocking persists as a factor after #1–3, I'll evaluate inlining the critical-path CSS for the above-the-fold hero, but I'll measure first rather than assume.)*

### 5. Re-measure and iterate
After implementing, rebuild, serve, and run Lighthouse (mobile × 2 for stability + desktop) to confirm LCP drops and the score rises, with no regression on FCP/TBT/CLS.

---
**Files to change:** `src/components/GlowCard.tsx`, `src/app/page.tsx`, `src/components/PlatformLanding.tsx`, `src/app/layout.tsx`, `src/app/globals.css`.
**Risk:** Low — all changes preserve the visual design. The `GlowCard` change is the most involved; I'll keep the pointer-spotlight effect working, just sourced differently. I'll verify the build stays clean (exit 0, no warnings) and re-run Lighthouse before reporting final numbers.