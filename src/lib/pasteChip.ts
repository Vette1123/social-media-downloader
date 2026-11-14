/**
 * Download pressed on an empty box. 226 people did it between 30 Oct and
 * 14 Nov (13% of landers) and were told to paste first; the tap is a user
 * gesture, so it can do the paste itself, as the chip would. Not where the
 * browser has already refused: that would only repeat the refusal.
 */
export function emptySubmitReadsClipboard(canRead: boolean, readDenied: boolean): boolean {
  return canRead && !readDenied
}

/**
 * What the Paste chip says when the browser won't hand over the clipboard.
 * "Paste the link manually" (before 14 Nov) left people to work out how; the
 * gesture differs by device, so name the one that works on this one.
 */
export function pasteDeniedKey(finePointer: boolean): 'errorClipboard' | 'errorLongPress' {
  return finePointer ? 'errorClipboard' : 'errorLongPress'
}

/**
 * True only when the browser reports clipboard reads as blocked for this site,
 * which Chromium remembers — the chip can then only fail, so it hides. Browsers
 * that can't answer (Safari, Firefox) ask per tap instead, so they keep it.
 */
export async function clipboardReadDenied(): Promise<boolean> {
  try {
    const status = await navigator.permissions.query({
      name: 'clipboard-read' as PermissionName,
    })
    return status.state === 'denied'
  } catch {
    return false
  }
}
