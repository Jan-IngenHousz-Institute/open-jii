import { usePrincipal } from "@/components/auth/principal-context";
import { withPrincipal } from "@/hooks/principal-query-key";
import { orpc } from "@/lib/orpc";
import { shouldRetryQuery } from "@/util/query-retry";
import { useQuery } from "@tanstack/react-query";

/**
 * An organization profile. The response carries the caller's role, and a private
 * organization 404s for non-members — neither is retried, and both are
 * principal-scoped so one user's answer is never served to the next.
 */
export const useOrganization = (organizationId: string, options?: { enabled?: boolean }) => {
  const { userId, isPending: isSessionPending } = usePrincipal();
  const input = { id: organizationId };

  return useQuery(
    orpc.organizations.getOrganization.queryOptions({
      input,
      queryKey: withPrincipal(orpc.organizations.getOrganization.queryKey({ input }), userId),
      retry: shouldRetryQuery,
      enabled: (options?.enabled ?? true) && !!organizationId && !isSessionPending,
    }),
  );
};
