import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook to list all published versions of a workbook.
 */
export const useWorkbookVersions = (workbookId: string, options?: { enabled?: boolean }) => {
  return useQuery(
    orpc.workbooks.listWorkbookVersions.queryOptions({
      input: { id: workbookId },
      enabled: options?.enabled ?? !!workbookId,
    }),
  );
};
