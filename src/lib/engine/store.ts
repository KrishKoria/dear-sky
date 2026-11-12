/** A minimal store that satisfies Svelte's store contract, so components can use `$readiness`. */
export interface Readable<T> {
  subscribe(run: (value: T) => void): () => void;
}

export interface Writable<T> extends Readable<T> {
  set(value: T): void;
  get(): T;
}

export function writable<T>(initial: T): Writable<T> {
  let value = initial;
  const subscribers = new Set<(value: T) => void>();
  return {
    subscribe(run) {
      subscribers.add(run);
      run(value);
      return () => subscribers.delete(run);
    },
    set(next) {
      if (Object.is(next, value)) return;
      value = next;
      for (const run of subscribers) run(value);
    },
    get: () => value,
  };
}
