import { orpc } from "@/lib/orpc";
import { guardWebWorkbookContent } from "@/lib/workbook-capabilities";
import { shouldRetryQuery } from "@/util/query-retry";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook to fetch a specific published workbook version (with full cell data).
 */
export function useWorkbookVersion(
  workbookId: string,
  versionId: string,
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled ?? !!(workbookId && versionId);

  const query = useQuery(
    orpc.workbooks.getWorkbookVersion.queryOptions({
      input: { id: workbookId, versionId },
      // A 403 here is an access answer, not a blip: retrying it would leave the
      // caller staring at a wrong interim state for the length of the backoff.
      retry: shouldRetryQuery,
      enabled,
      select: (value) => guardWebWorkbookContent(value),
    }),
  );

  return {
    data: enabled ? query.data : undefined,
    isLoading: query.isLoading,
    error: query.error,
  };
}
