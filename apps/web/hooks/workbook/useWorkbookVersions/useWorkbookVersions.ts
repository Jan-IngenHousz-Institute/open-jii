import { tsr } from "@/shared/api/tsr";

/**
 * Hook to list all published versions of a workbook.
 */
export const useWorkbookVersions = (workbookId: string, options?: { enabled?: boolean }) => {
  return tsr.workbooks.listWorkbookVersions.useQuery({
    queryData: { params: { id: workbookId } },
    queryKey: ["workbookVersions", workbookId],
    enabled: options?.enabled ?? !!workbookId,
  });
};
