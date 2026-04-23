import { tsr } from "../../../lib/tsr";

/**
 * Lightweight hook that fetches all workbooks without filtering, search, or URL state.
 * Intended for selector/dropdown components that need a simple list.
 */
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
