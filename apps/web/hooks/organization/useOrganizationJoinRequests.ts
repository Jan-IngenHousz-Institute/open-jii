import { tsr } from "@/lib/tsr";
import { shouldRetryQuery } from "@/util/query-retry";

/** Pending join requests for an organization (owner/admin only). */
export const useOrganizationJoinRequests = (id: string, enabled = true) => {
  return tsr.organizations.listJoinRequests.useQuery({
    queryData: { params: { id } },
    queryKey: ["organization-join-requests", id],
    retry: shouldRetryQuery,
    enabled,
  });
};
