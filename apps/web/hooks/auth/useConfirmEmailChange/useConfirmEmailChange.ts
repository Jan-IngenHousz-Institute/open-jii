"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { revalidateAuth } from "~/app/actions/revalidate";

import { authClient } from "@repo/auth/client";

/**
 * Hook to prove the new address with its code. The account takes the address, verified, and
 * keeps its session and its connected accounts.
 */
export function useConfirmEmailChange() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ newEmail, otp }: { newEmail: string; otp: string }) =>
      authClient.emailOtp.changeEmail({ newEmail, otp }),
    onSuccess: async (response) => {
      if (response.data) {
        // The client refreshes the session after a code sign-in, but not after this route.
        authClient.$store.notify("$sessionSignal");
        await queryClient.invalidateQueries({ queryKey: ["auth"] });
        await revalidateAuth();
      }
    },
  });
}
