/**
 * Map `items` through an async `fn` with at most `limit` tasks in flight.
 * Results are returned in input order. The first rejection propagates after
 * in-flight tasks settle; remaining items are not started.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let failed = false;
  const workers = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    async () => {
      while (!failed && next < items.length) {
        const i = next++;
        try {
          results[i] = await fn(items[i]!, i);
        } catch (err) {
          failed = true;
          throw err;
        }
      }
    },
  );
  await Promise.all(workers);
  return results;
}
