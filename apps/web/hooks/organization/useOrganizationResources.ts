import { tsr } from "@/lib/tsr";
import { shouldRetryQuery } from "@/util/query-retry";

/** An organization's public resources, grouped by entity type. */
export const useOrganizationResources = (id: string) => {
  return tsr.organizations.getOrganizationResources.useQuery({
    queryData: { params: { id } },
    queryKey: ["organization-resources", id],
    retry: shouldRetryQuery,
  });
};
