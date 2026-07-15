"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authClient } from "@repo/auth/client";

/**
 * Hook to register a new passkey (triggers the WebAuthn ceremony).
 * The register response always resolves with { data, error }, so errors
 * (including user cancellation) are rethrown for onError handling.
 */
export function useAddPasskey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name?: string }) => {
      const response = await authClient.passkey.addPasskey(input);
      if (response?.error) throw new Error(response.error.message);
      return response?.data ?? null;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth", "passkeys"] });
    },
  });
}
