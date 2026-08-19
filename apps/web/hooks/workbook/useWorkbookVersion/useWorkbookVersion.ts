import { orpc } from "@/lib/orpc";
import { shouldRetryQuery } from "@/util/query-retry";
import { useQuery } from "@tanstack/react-query";

import type { WorkbookVersion } from "@repo/api/domains/workbook/workbook-version.schema";

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
      // Re-pinning mints a new versionId, so a fresh key with no data would drop
      // callers to `isLoading` and flash a skeleton (OJD-1723). Hold the last
      // version, but only within the same workbook.
      placeholderData: (previous?: WorkbookVersion) =>
        previous?.workbookId === workbookId ? previous : undefined,
      enabled,
    }),
  );

  return {
    data: enabled ? query.data : undefined,
    isLoading: query.isLoading,
    error: query.error,
  };
}
