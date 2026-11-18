"use client";

import { useQuery } from "@tanstack/react-query";

import { authClient } from "@repo/auth/client";

export const PASSKEYS_KEY = ["auth", "passkeys"] as const;

/**
 * Hook to list the current user's passkeys
 */
export function usePasskeys() {
  return useQuery({
    queryKey: PASSKEYS_KEY,
    queryFn: async () => {
      const response = await authClient.passkey.listUserPasskeys();
      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
  });
}
