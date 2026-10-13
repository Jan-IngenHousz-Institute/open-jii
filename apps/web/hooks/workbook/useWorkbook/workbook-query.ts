import type { QueryUtils } from "@/lib/orpc";
import { shouldRetryQuery } from "@/util/query-retry";

/** The workbook query, built the same way for the hook and for the server that prefetches it. */
export function workbookQuery(utils: QueryUtils, id: string) {
  return utils.workbooks.getWorkbook.queryOptions({ input: { id }, retry: shouldRetryQuery });
}

// A workbook's cells, rendered on the server, take up to about 30 KB of HTML each, and a Lambda
// cannot return more than 6 MB: a 921-cell workbook failed with 502. Larger ones render in the
// browser instead.
const MAX_SERVER_RENDERED_CELLS = 100;

/** Whether a fetched workbook is small enough for the server to render with its cells. */
export function fitsServerRender(workbook: unknown): boolean {
  if (typeof workbook !== "object" || workbook === null || !("cells" in workbook)) {
    return false;
  }

  const { cells } = workbook;
  return Array.isArray(cells) && cells.length <= MAX_SERVER_RENDERED_CELLS;
}
