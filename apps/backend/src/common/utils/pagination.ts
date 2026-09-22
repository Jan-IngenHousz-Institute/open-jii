/**
 * Wrap a page of rows in the shared list envelope. `totalPages` is 0 for an empty set,
 * so an out-of-range page reports empty items against the real totals rather than failing.
 */
export function toPage<T, R>(
  result: { items: T[]; totalCount: number },
  page: number,
  pageSize: number,
  map: (items: T[]) => R[],
): { items: R[]; page: number; pageSize: number; totalPages: number; totalCount: number } {
  return {
    items: map(result.items),
    page,
    pageSize,
    totalPages: Math.ceil(result.totalCount / pageSize),
    totalCount: result.totalCount,
  };
}
