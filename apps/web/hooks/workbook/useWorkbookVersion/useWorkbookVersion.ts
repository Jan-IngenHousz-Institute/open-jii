import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/lib/orpc";

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
      enabled,
    }),
  );

  return {
    data: enabled ? query.data : undefined,
    isLoading: query.isLoading,
    error: query.error,
  };
}
