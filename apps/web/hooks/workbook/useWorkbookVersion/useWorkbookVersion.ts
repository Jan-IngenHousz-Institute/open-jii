import { tsr } from "@/lib/tsr";

/**
 * Hook to fetch a specific published workbook version (with full cell data).
 */
export function useWorkbookVersion(
  workbookId: string,
  versionId: string,
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled ?? !!(workbookId && versionId);

  const query = tsr.workbooks.getWorkbookVersion.useQuery({
    queryData: {
      params: { id: workbookId || "placeholder", versionId: versionId || "placeholder" },
    },
    queryKey: ["workbookVersion", workbookId, versionId],
    enabled,
  });

  return {
    data: enabled ? query.data?.body : undefined,
    isLoading: query.isLoading,
    error: query.error,
  };
}
