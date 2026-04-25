import { shouldRetryQuery } from "@/util/query-retry";

import { tsr } from "../../../lib/tsr";

export function useWorkbook(id: string, options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? !!id;

  const query = tsr.workbooks.getWorkbook.useQuery({
    queryData: { params: { id: id || "placeholder" } },
    queryKey: ["workbook", id],
    retry: shouldRetryQuery,
    enabled,
  });

  return {
    data: enabled ? query.data?.body : undefined,
    isLoading: query.isLoading,
    error: query.error,
  };
}
