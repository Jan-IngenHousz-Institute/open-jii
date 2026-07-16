import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook to search for places using text query
 * @param query The search query
 * @param maxResults Maximum number of results to return
 * @param enabled Whether the query should be enabled
 * @returns Query result containing place search results
 */
export const useLocationSearch = (query: string, maxResults?: number, enabled = true) => {
  return useQuery(
    orpc.experiments.searchPlaces.queryOptions({
      input: { query, maxResults },
      enabled: enabled && query.length > 2, // Only search when query is longer than 2 characters
    }),
  );
};
