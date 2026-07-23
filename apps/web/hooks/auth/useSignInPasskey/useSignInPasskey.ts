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
      // Runtime can resolve undefined despite the client types.
      const response = (await authClient.signIn.passkey(input)) as
        | Awaited<ReturnType<typeof authClient.signIn.passkey>>
        | undefined;
      if (!response) throw new Error("Passkey sign-in returned no response");
      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });
}
