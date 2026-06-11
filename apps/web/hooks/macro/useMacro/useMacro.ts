import { shouldRetryQuery } from "@/shared/api/query-retry";
import { tsr } from "@/shared/api/tsr";

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
