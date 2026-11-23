"use client";

import { useMutation } from "@tanstack/react-query";

import { authClient } from "@repo/auth/client";

/**
 * Hook to send a code to the address an account without one is taking. Only an account that
 * still needs an address may; the server refuses everyone else.
 */
export function useRequestEmailChange() {
  return useMutation({
    mutationFn: async (newEmail: string) => authClient.emailOtp.requestEmailChange({ newEmail }),
  });
}
