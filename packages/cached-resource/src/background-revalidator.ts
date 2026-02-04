export interface Revalidator {
  trigger(key: string, revalidate: () => Promise<void>): void;
  waitForRevalidation(key?: string): Promise<void>;
}

export function createRevalidator(): Revalidator {
  const inflight = new Map<string, Promise<void>>();

  return {
    trigger(key, revalidate) {
      if (inflight.has(key)) return;

      const promise = revalidate()
        .catch(() => {})
        .finally(() => inflight.delete(key));

      inflight.set(key, promise);
    },

    async waitForRevalidation(key?) {
      if (key) {
        await inflight.get(key);
      } else {
        await Promise.all(inflight.values());
      }
    },
  };
}
