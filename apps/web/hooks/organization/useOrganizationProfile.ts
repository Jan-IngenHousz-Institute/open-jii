import { tsr } from "@/lib/tsr";
import { shouldRetryQuery } from "@/util/query-retry";

/** A single organization's public/profile summary (gated for private orgs). */
export const useOrganizationProfile = (id: string) => {
  return tsr.organizations.getOrganization.useQuery({
    queryData: { params: { id } },
    queryKey: ["organization", id],
    retry: shouldRetryQuery,
  });
};
