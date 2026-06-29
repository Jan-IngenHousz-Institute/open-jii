import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/lib/orpc";
import { shouldRetryQuery } from "@/util/query-retry";

export function useMacro(id: string, enabled = true) {
  const query = useQuery(
    orpc.macros.getMacro.queryOptions({
      input: { id },
      retry: shouldRetryQuery,
      enabled: enabled && !!id,
    }),
  );

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
  };
}
