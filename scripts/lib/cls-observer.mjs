/**
 * In-page layout-shift recorder, shared by cls-audit (a refresh) and cls-flow
 * (paste -> resolve -> result). Runs before any page script; collects every
 * shift without recent input into `window.__shifts`, each with the nodes that
 * moved (`sources`) and the deepest elements whose height changed since the
 * last shift (`grew`), which is usually what pushed them.
 */
export function shiftRecorderSource() {
  return `
    const label = (node) => {
      if (!node || node.nodeType !== 1) return node ? '#text' : '?'
      const cls = (node.getAttribute('class') || '').split(/\\s+/).filter(Boolean).slice(0, 3).join('.')
      const text = (node.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 50)
      return node.tagName.toLowerCase() + (cls ? '.' + cls : '') + (text ? ' "' + text + '"' : '')
    }
    // A shift names what moved, not what pushed it. Heights are snapshotted at
    // DOMContentLoaded and again after each shift; the deepest elements whose
    // height changed since are the likely cause.
    let heights = new Map()
    const snapshot = () => {
      const m = new Map()
      for (const el of document.querySelectorAll('body *')) m.set(el, el.getBoundingClientRect().height)
      return m
    }
    const growers = () => {
      const now = snapshot()
      const changed = new Map()
      for (const [el, h] of now) {
        const delta = Math.round(h - (heights.get(el) ?? 0))
        if (Math.abs(delta) >= 40) changed.set(el, delta)
      }
      heights = now
      const deepest = [...changed].filter(([el, delta]) =>
        ![...el.children].some((c) => changed.has(c) && Math.abs(changed.get(c) - delta) < 8))
      return deepest
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
        .slice(0, 4)
        .map(([el, delta]) => (delta > 0 ? '+' : '') + delta + 'px ' + label(el) + (heights.has(el) ? '' : ' (new)'))
    }
    document.addEventListener('DOMContentLoaded', () => { heights = snapshot() })
    window.__shifts = []
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.hadRecentInput) continue
        window.__shifts.push({
          value: e.value,
          at: Math.round(e.startTime),
          grew: growers(),
          sources: (e.sources || []).map((s) => ({
            node: label(s.node),
            from: [s.previousRect.y, s.previousRect.height].map(Math.round),
            to: [s.currentRect.y, s.currentRect.height].map(Math.round),
          })),
        })
      }
    }).observe({ type: 'layout-shift', buffered: true })
`
}
