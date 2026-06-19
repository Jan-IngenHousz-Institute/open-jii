import { tsr } from "@/lib/tsr";
import { shouldRetryQuery } from "@/util/query-retry";

/**
 * Who inherits access to a resource through its owning org (members + teams).
 * Member-gated server-side — non-members get a 403, surfaced as an error.
 */
export const useOrganizationAccess = (organizationId: string | null | undefined) => {
  return tsr.organizations.getOrganizationAccess.useQuery({
    queryData: { params: { id: organizationId ?? "" } },
    queryKey: ["organization-access", organizationId ?? ""],
    retry: shouldRetryQuery,
    enabled: Boolean(organizationId),
  });
};
