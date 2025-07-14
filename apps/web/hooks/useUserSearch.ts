import { tsr } from "@/lib/tsr";

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
  return tsr.users.searchUsers.useQuery({
    queryData: {
      query: {
        query: queryString,
        limit: options?.limit,
        offset: options?.offset,
      },
    },
    queryKey: ["user-search", queryString, options?.limit, options?.offset],
    enabled: queryString.trim().length > 0,
  });
};
