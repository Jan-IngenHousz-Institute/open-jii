import { withPrincipal } from "@/hooks/principal-query-key";
import { orpc } from "@/lib/orpc";
import { shouldRetryQuery } from "@/util/query-retry";
import { useQuery } from "@tanstack/react-query";

import { useSession } from "@repo/auth/client";

/**
 * The organization's resources showcase. Access-scoped server-side, so what comes
 * back differs per caller and the cache is scoped to the principal.
 */
export const useOrganizationResources = (
  organizationId: string,
  options?: { enabled?: boolean },
) => {
  const { data: session, isPending: isSessionPending } = useSession();
  const userId = session?.user.id;
  const input = { id: organizationId };

  return useQuery(
    orpc.organizations.listOrganizationResources.queryOptions({
      input,
      queryKey: withPrincipal(
        orpc.organizations.listOrganizationResources.queryKey({ input }),
        userId,
      ),
      retry: shouldRetryQuery,
      enabled: (options?.enabled ?? true) && !!organizationId && !isSessionPending,
    }),
  );
};
