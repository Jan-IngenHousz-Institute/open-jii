import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/lib/orpc";

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
