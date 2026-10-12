import { usePrincipal } from "@/components/auth/principal-context";
import { withPrincipal } from "@/hooks/principal-query-key";
import { orpc } from "@/lib/orpc";
import { shouldRetryQuery } from "@/util/query-retry";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook to search users by name or email
 * The query client will handle error states automatically
 *
 * @param query Search string
 * @param options Optional: limit, offset, etc.
 * @returns Query result containing the users
 */
export const useUserSearch = (
  queryString: string,
  options?: { limit?: number; offset?: number },
) => {
  const { userId, isPending: isSessionPending } = usePrincipal();
  const query = queryString.trim();
  const input = { query, limit: options?.limit, offset: options?.offset };

  return useQuery(
    orpc.users.searchUsers.queryOptions({
      input,
      queryKey: withPrincipal(orpc.users.searchUsers.queryKey({ input }), userId),
      retry: shouldRetryQuery,
      enabled: query.length >= 2 && !isSessionPending,
    }),
  );
};
