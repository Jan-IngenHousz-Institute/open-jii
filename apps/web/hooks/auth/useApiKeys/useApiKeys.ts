"use client";

import { useQuery } from "@tanstack/react-query";

import { authClient } from "@repo/auth/client";

/**
 * Hook to list the current user's API keys (newest first)
 */
export function useApiKeys() {
  return useQuery({
    queryKey: ["auth", "api-keys"],
    queryFn: async () => {
      const response = await authClient.apiKey.list({
        query: { sortBy: "createdAt", sortDirection: "desc" },
      });
      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
  });
}
