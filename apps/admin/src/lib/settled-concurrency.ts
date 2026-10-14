/** Runs independent reads with a fixed request ceiling and preserves per-item failures. */
export async function mapSettledWithConcurrency<TItem, TResult>(
  items: readonly TItem[],
  concurrency: number,
  mapper: (item: TItem) => Promise<TResult>,
  signal?: AbortSignal,
): Promise<PromiseSettledResult<TResult>[]> {
  const results = new Array<PromiseSettledResult<TResult>>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        if (signal?.aborted) throw new DOMException('요청이 취소되었습니다.', 'AbortError');
        const itemIndex = nextIndex;
        nextIndex += 1;
        try {
          results[itemIndex] = {
            status: 'fulfilled',
            value: await mapper(items[itemIndex] as TItem),
          };
        } catch (reason) {
          if (signal?.aborted) throw reason;
          results[itemIndex] = { status: 'rejected', reason };
        }
      }
    }),
  );

  return results;
}
