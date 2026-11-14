/**
 * How many times in a row the same link has failed. Two people retried one X
 * post ~50 times on 14 Nov against an identical banner; the count lets the
 * second failure say retrying won't help (see errorMessages' failureLine).
 */
export function createFailureStreak() {
  let last = ''
  let count = 0
  return {
    /** Record a failure of `link`; returns how many in a row it has now failed. */
    count(link: string): number {
      count = last === link ? count + 1 : 1
      last = link
      return count
    },
    /** A success ends the streak. */
    reset(): void {
      last = ''
      count = 0
    },
  }
}
