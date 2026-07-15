"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authClient } from "@repo/auth/client";

/**
 * Hook to sign in with a passkey (triggers the WebAuthn ceremony).
 * The sign-in response always resolves with { data, error }, so errors
 * (including user cancellation) are rethrown for onError handling.
 */
export function useSignInPasskey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input?: { autoFill?: boolean }) => {
      const response = await authClient.signIn.passkey(input);
      if (response?.error) throw new Error(response.error.message);
      return response?.data ?? null;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}
