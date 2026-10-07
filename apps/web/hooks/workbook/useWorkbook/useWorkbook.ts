import { orpc } from "@/lib/orpc";
import type { QueryUtils } from "@/lib/orpc";
import { shouldRetryQuery } from "@/util/query-retry";
import { useQuery } from "@tanstack/react-query";

/** The workbook query, built the same way for the hook and for the server that prefetches it. */
export function workbookQuery(utils: QueryUtils, id: string) {
  return utils.workbooks.getWorkbook.queryOptions({ input: { id }, retry: shouldRetryQuery });
}

export function useWorkbook(id: string, options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? !!id;

  const query = useQuery({ ...workbookQuery(orpc, id), enabled });

  return {
    data: enabled ? query.data : undefined,
    isLoading: query.isLoading,
    error: query.error,
  };
}
