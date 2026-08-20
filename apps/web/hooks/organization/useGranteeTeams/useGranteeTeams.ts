import { withPrincipal } from "@/hooks/principal-query-key";
import { orpc } from "@/lib/orpc";
import { shouldRetryQuery } from "@/util/query-retry";
import { useQuery } from "@tanstack/react-query";

import type { SharingResourceType } from "@repo/api/domains/sharing/sharing.schema";
import { useSession } from "@repo/auth/client";

/**
 * Teams the grantee picker may offer: those of the resource's owning organization.
 * Share-gated, and a denial answers 404 — so it is not retried, and the cache is
 * principal-scoped like the collaborators list it sits beside.
 */
export const useGranteeTeams = (
  resourceType: SharingResourceType,
  resourceId: string,
  options?: { enabled?: boolean },
) => {
  const { data: session, isPending: isSessionPending } = useSession();
  const userId = session?.user.id;
  const input = { resourceType, id: resourceId };

  return useQuery(
    orpc.organizations.listGranteeTeams.queryOptions({
      input,
      queryKey: withPrincipal(orpc.organizations.listGranteeTeams.queryKey({ input }), userId),
      retry: shouldRetryQuery,
      enabled: (options?.enabled ?? true) && !!resourceId && !isSessionPending,
    }),
  );
};
