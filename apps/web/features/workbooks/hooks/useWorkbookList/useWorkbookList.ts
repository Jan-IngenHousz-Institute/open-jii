import { tsr } from "@/shared/api/tsr";

export function useWorkbookList() {
  const query = tsr.workbooks.listWorkbooks.useQuery({
    queryData: { query: {} },
    queryKey: ["workbooks", "list"],
  });

  return {
    data: query.data?.body,
    isLoading: query.isLoading,
    error: query.error,
  };
}
