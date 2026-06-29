import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/lib/orpc";
import { shouldRetryQuery } from "@/util/query-retry";

export function useWorkbook(id: string, options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? !!id;

  const query = useQuery(
    orpc.workbooks.getWorkbook.queryOptions({
      input: { id },
      retry: shouldRetryQuery,
      enabled,
    }),
  );

  return {
    data: enabled ? query.data : undefined,
    isLoading: query.isLoading,
    error: query.error,
  };
}
