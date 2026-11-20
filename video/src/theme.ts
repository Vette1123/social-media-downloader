import { Easing } from 'remotion'

/** The site's own palette (src/lib/ogKit.tsx, src/lib/brandMark.ts). */
export const C = {
  bg: '#07080b',
  ink: '#fafafa',
  dim: 'rgba(250,250,250,0.62)',
  faint: 'rgba(250,250,250,0.12)',
  teal: '#2dd4bf',
  mint: '#5eead4',
  cyan: '#22d3ee',
  indigo: '#6366f1',
  violet: '#818cf8',
  green: '#4ade80',
}

export const GRADIENT = 'linear-gradient(120deg, #5eead4 0%, #22d3ee 45%, #818cf8 100%)'
export const FONT = "Geist, 'Segoe UI', sans-serif"

export const OUT_EXPO = Easing.bezier(0.16, 1, 0.3, 1)
export const OUT_QUART = Easing.bezier(0.25, 1, 0.5, 1)
export const IN_OUT = Easing.bezier(0.77, 0, 0.175, 1)
