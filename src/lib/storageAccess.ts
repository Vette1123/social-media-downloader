/**
 * Whether localStorage can be touched at all. Never throws.
 *
 * A browser with site storage blocked throws a SecurityError from the
 * `localStorage` getter itself, and `typeof localStorage` calls that getter, so
 * neither a typeof guard nor a try around getItem alone is enough.
 */
export function canUseLocalStorage(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage
  } catch {
    return false
  }
}
