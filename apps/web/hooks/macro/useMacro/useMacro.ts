import { shouldRetryQuery } from "@/util/query-retry";

import { tsr } from "../../../lib/tsr";

export function useMacro(id: string) {
  const query = tsr.macros.getMacro.useQuery({
    queryData: { params: { id } },
    queryKey: ["macro", id],
    retry: shouldRetryQuery,
  });

  return {
    data: query.data?.body,
    isLoading: query.isLoading,
    error: query.error,
  };
}
