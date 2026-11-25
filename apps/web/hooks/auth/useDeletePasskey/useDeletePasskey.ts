"use client";

import { unwrapAuthResult } from "@/hooks/organization/auth-organization-result";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authClient } from "@repo/auth/client";

/**
 * Hook to delete a passkey. A refusal keeps its code, so the dialog can tell
 * `LAST_SIGN_IN_METHOD` from any other failure.
 */
export function useDeletePasskey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string }) =>
      unwrapAuthResult(await authClient.passkey.deletePasskey(input)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth", "passkeys"] });
    },
  });
}
