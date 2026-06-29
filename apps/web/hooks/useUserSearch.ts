import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/lib/orpc";

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
  return useQuery(
    orpc.users.searchUsers.queryOptions({
      input: {
        query: queryString,
        limit: options?.limit,
        offset: options?.offset,
      },
      enabled: queryString.trim().length > 0,
    }),
  );
};
