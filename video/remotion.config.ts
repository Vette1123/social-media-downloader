import { Config } from '@remotion/cli/config'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

Config.setEntryPoint('./src/index.ts')
// PNG frames: a JPEG generation before H.264 is where dark gradients start to band.
Config.setVideoImageFormat('png')
Config.setOverwriteOutput(true)
Config.setDelayRenderTimeoutInMilliseconds(120_000)
Config.setConcurrency(4)
// The film draws the site's own art (src/lib/brandMark.ts, src/lib/ogGlyphs.ts), so
// `@/` resolves into the site the same way it does there.
Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: { ...(config.resolve?.alias ?? {}), '@': resolve(process.cwd(), '..', 'src') },
  },
}))

// Prefer the Chrome already on the machine over downloading Remotion's headless shell.
const browser = [
  process.env.REMOTION_BROWSER,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((p): p is string => !!p && existsSync(p))
if (browser) Config.setBrowserExecutable(browser)
