import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

export function useWorkbookList() {
  const query = useQuery(orpc.workbooks.listWorkbooks.queryOptions({ input: {} }));

  return {
    data: query.data,
    isLoading: query.isLoading,
    error: query.error,
  };
}
