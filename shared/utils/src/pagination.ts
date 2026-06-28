export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

/**
 * Repeatedly calls `fetchPage`, following `nextCursor`, until exhausted.
 * `maxPages` is a safety cap to avoid runaway loops against a misbehaving API.
 */
export async function fetchAllPages<T>(
  fetchPage: (cursor?: string) => Promise<CursorPage<T>>,
  maxPages = 50,
): Promise<T[]> {
  const results: T[] = [];
  let cursor: string | undefined;
  let pages = 0;

  do {
    const page = await fetchPage(cursor);
    results.push(...page.items);
    cursor = page.nextCursor ?? undefined;
    pages += 1;
  } while (cursor && pages < maxPages);

  return results;
}
