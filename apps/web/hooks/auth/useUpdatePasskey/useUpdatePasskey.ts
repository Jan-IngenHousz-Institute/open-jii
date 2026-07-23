"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authClient } from "@repo/auth/client";

/**
 * Hook to rename a passkey
 */
export function useUpdatePasskey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; name: string }) => {
      const response = await authClient.passkey.updatePasskey(input);
      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth", "passkeys"] });
    },
  });
}
