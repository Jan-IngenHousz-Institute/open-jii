"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authClient } from "@repo/auth/client";

/**
 * Hook to create an API key. The returned data contains the full key,
 * which is only ever shown once.
 */
export function useCreateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; expiresIn?: number }) => {
      const response = await authClient.apiKey.create(input);
      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth", "api-keys"] });
    },
  });
}
