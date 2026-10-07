import type { QueryUtils } from "@/lib/orpc";
import { shouldRetryQuery } from "@/util/query-retry";

/** The workbook query, built the same way for the hook and for the server that prefetches it. */
export function workbookQuery(utils: QueryUtils, id: string) {
  return utils.workbooks.getWorkbook.queryOptions({ input: { id }, retry: shouldRetryQuery });
}
