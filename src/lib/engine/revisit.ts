/**
 * How long ago the writer kept a letter, as a plain lowercase phrase for the revisit note's prompt
 * ("earlier today", "yesterday", "5 days ago", "3 weeks ago", "4 months ago", "over a year ago").
 * Today and yesterday are calendar days in local time; a clock set backwards reads as today.
 */
const DAY_MS = 86_400_000;

const startOfDay = (ms: number) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

export function keptAgo(keptAt: number, now: number): string {
  // Rounded, because a local day is 23 or 25 hours long when the clocks change.
  const days = Math.max(0, Math.round((startOfDay(now) - startOfDay(keptAt)) / DAY_MS));
  if (days === 0) return 'earlier today';
  if (days === 1) return 'yesterday';
  if (days <= 13) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks <= 8) return `${weeks} weeks ago`;
  if (days >= 365) return 'over a year ago';
  return `${Math.floor(days / 30.44)} months ago`;
}
