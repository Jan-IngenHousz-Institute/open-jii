import { usePrincipal } from "@/components/auth/principal-context";
import { withPrincipal } from "@/hooks/principal-query-key";
import { orpc } from "@/lib/orpc";
import { shouldRetryQuery } from "@/util/query-retry";
import { useQuery } from "@tanstack/react-query";

/**
 * The organization's resources showcase. Access-scoped server-side, so what comes
 * back differs per caller and the cache is scoped to the principal.
 */
export const useOrganizationResources = (
  organizationId: string,
  options?: { enabled?: boolean },
) => {
  const { userId, isPending: isSessionPending } = usePrincipal();
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
