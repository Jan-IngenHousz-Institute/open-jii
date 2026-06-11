import { shouldRetryQuery } from "@/shared/api/query-retry";
import { tsr } from "@/shared/api/tsr";

export function useWorkbook(id: string, options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? !!id;

  const query = tsr.workbooks.getWorkbook.useQuery({
    queryData: { params: { id } },
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
