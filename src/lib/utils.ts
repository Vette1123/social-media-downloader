import { clsx, type ClassValue } from 'clsx'

/**
 * Conditional class joining. `clsx` only — deliberately NOT `twMerge(clsx(…))`.
 *
 * tailwind-merge exists to make a later class beat an earlier conflicting one,
 * and nothing here ever conflicts: the only utilities `Surface` emits are its
 * own `surface*` / `card-*` tokens plus one `rounded-*`, and no call site in
 * the tree passes a competing `rounded-*`. So twMerge was walking a 28 KB
 * class-group trie on every render to return its input unchanged — and it
 * reached the browser through the client components that render a `Surface`,
 * which is 8.8 KB gzipped on the critical path of every page.
 *
 * If a caller ever does need to override a `Surface` token, change the token,
 * not this function.
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}
