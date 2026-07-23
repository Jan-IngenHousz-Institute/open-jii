"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authClient } from "@repo/auth/client";

/**
 * Hook to delete a passkey
 */
export function useDeletePasskey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string }) => {
      const response = await authClient.passkey.deletePasskey(input);
      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth", "passkeys"] });
    },
  });
}
