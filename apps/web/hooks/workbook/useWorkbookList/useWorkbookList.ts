import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/lib/orpc";

export function useWorkbookList() {
  const query = useQuery(orpc.workbooks.listWorkbooks.queryOptions({ input: {} }));

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
  };
}
