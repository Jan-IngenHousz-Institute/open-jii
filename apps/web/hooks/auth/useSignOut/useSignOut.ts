"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { revalidateAuth } from "~/app/actions/revalidate";

import { authClient } from "@repo/auth/client";

/**
 * Hook to sign out
 */
export function useSignOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await authClient.signOut();
    },
    onSuccess: async () => {
      // Clear session cache
      queryClient.setQueryData(["auth", "session"], null);
      void queryClient.invalidateQueries({ queryKey: ["auth"] });

      // Revalidate Next.js cache
      await revalidateAuth();
    },
  });
}
