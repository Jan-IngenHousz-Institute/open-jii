import { withPrincipal } from "@/hooks/principal-query-key";
import { orpc } from "@/lib/orpc";
import { shouldRetryQuery } from "@/util/query-retry";
import { useQuery } from "@tanstack/react-query";

import { useSession } from "@repo/auth/client";

/** An organization's teams with their members. Members only. */
export const useOrganizationTeams = (organizationId: string, options?: { enabled?: boolean }) => {
  const { data: session, isPending: isSessionPending } = useSession();
  const userId = session?.user.id;
  const input = { id: organizationId };

  return useQuery(
    orpc.organizations.listOrganizationTeams.queryOptions({
      input,
      queryKey: withPrincipal(orpc.organizations.listOrganizationTeams.queryKey({ input }), userId),
      retry: shouldRetryQuery,
      enabled: (options?.enabled ?? true) && !!organizationId && !isSessionPending,
    }),
  );
};
