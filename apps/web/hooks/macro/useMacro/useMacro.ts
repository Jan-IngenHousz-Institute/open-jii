import { shouldRetryQuery } from "@/util/query-retry";

import { tsr } from "../../../lib/tsr";

export function useMacro(id: string, version?: number) {
  const query = tsr.macros.getMacro.useQuery({
    queryData: { params: { id }, query: { version } },
    queryKey: ["macro", id, version],
    retry: shouldRetryQuery,
  });

  return {
    data: query.data?.body,
    isLoading: query.isLoading,
    error: query.error,
  };
}
