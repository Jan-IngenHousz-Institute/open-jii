import { tsr } from "@/lib/tsr";
import { shouldRetryQuery } from "@/util/query-retry";

/** The public organization directory, optionally filtered by a search string. */
export const usePublicOrganizations = (search?: string) => {
  return tsr.organizations.listPublicOrganizations.useQuery({
    queryData: { query: search ? { search } : {} },
    queryKey: ["public-organizations", search ?? ""],
    retry: shouldRetryQuery,
  });
};
