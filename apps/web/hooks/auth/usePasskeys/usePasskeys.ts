"use client";

import { useQuery } from "@tanstack/react-query";

import { authClient } from "@repo/auth/client";

/**
 * Hook to list the current user's passkeys
 */
export function usePasskeys() {
  return useQuery({
    queryKey: ["auth", "passkeys"],
    queryFn: async () => {
      const response = await authClient.passkey.listUserPasskeys();
      if (response.error) throw new Error(response.error.message);
      return response.data;
    },
  });
}
