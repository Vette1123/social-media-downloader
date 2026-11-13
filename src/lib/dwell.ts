/**
 * "Seen" for an impression: on screen (the caller decides how much counts)
 * for `dwellMs` without a break, reported once. Mounting is not seeing: a
 * card under a long result can mount and never be scrolled to.
 */
export function createDwell(onSeen: () => void, dwellMs: number) {
  let timer: ReturnType<typeof setTimeout> | null = null
  let done = false
  const stop = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }
  return {
    update(visible: boolean) {
      if (done) return
      if (!visible) return stop()
      if (timer !== null) return
      timer = setTimeout(() => {
        timer = null
        done = true
        onSeen()
      }, dwellMs)
    },
    stop,
  }
}
