/**
 * How far the shared sky has been dragged (D44), for the night behind everything: SkyView sets
 * it once a frame, and the stars in Sky.svelte follow it slowly. It isn't reset on leaving the
 * sky; the stars wrap around, so wherever they stop looks just as it did.
 */
type Listener = (x: number) => void;

const listeners = new Set<Listener>();
let at = 0;

export function setPan(x: number) {
  if (x === at) return;
  at = x;
  for (const l of listeners) l(x);
}

export function onPan(listener: Listener): () => void {
  listeners.add(listener);
  listener(at);
  return () => listeners.delete(listener);
}
