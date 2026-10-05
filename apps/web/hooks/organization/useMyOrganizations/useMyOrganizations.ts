import { usePrincipal } from "@/components/auth/principal-context";
import { withPrincipal } from "@/hooks/principal-query-key";
import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * The caller's own memberships — nav, the organization pages and the org picker on
 * every resource create form. Personal workspace included, flagged `isPersonal`.
 */
export const useMyOrganizations = (options?: { enabled?: boolean }) => {
  const { userId, isPending: isSessionPending } = usePrincipal();

  return useQuery(
    orpc.organizations.listMyOrganizations.queryOptions({
      queryKey: withPrincipal(orpc.organizations.listMyOrganizations.queryKey({}), userId),
      enabled: (options?.enabled ?? true) && !isSessionPending && !!userId,
    }),
  );
};
