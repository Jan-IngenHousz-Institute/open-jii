import { shouldRetryQuery } from "@/util/query-retry";

import { tsr } from "../../../lib/tsr";

export function useMacro(id: string, version?: number) {
  const query = tsr.macros.getMacro.useQuery({
    queryData: { params: { id }, query: { version } },
    // Version-pinned reads get their own cache entry; the bare key is kept for callers
    // that want the live head (so their optimistic updates still match).
    queryKey: version != null ? ["macro", id, version] : ["macro", id],
    retry: shouldRetryQuery,
  });

  return {
    data: query.data?.body,
    isLoading: query.isLoading,
    error: query.error,
  };
}
