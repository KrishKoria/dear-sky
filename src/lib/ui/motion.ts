/**
 * Whether the person asked for less motion. Read once and kept current by the query's own
 * change event, so per-frame code can ask without a `matchMedia` call every time.
 */
export function followMotion(query: Pick<MediaQueryList, 'matches' | 'addEventListener'>): () => boolean {
  let reduced = query.matches;
  query.addEventListener('change', (e) => (reduced = e.matches));
  return () => reduced;
}

let shared: (() => boolean) | undefined;

/** True when the person prefers reduced motion; one shared query for the whole app. */
export function calm(): boolean {
  if (!shared) {
    if (typeof matchMedia === 'undefined') return false;
    shared = followMotion(matchMedia('(prefers-reduced-motion: reduce)'));
  }
  return shared();
}
