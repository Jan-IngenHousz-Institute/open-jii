"use client";

import { allResourceCacheFamilies } from "@/hooks/sharing/resource-cache-keys";
import { orpc } from "@/lib/orpc";
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

      // Drop the authorization-sensitive caches outright rather than leaving the
      // signed-out user's grants, organizations, invitee emails, private resource
      // content and resolved capabilities resident in a module-level QueryClient
      // that survives sign-out → sign-in.
      //
      // For the sharing and access queries the principal is already in the key
      // (see `principal-query-key`), so the next user could not have read them
      // anyway and this only stops them lingering. The resource detail and list
      // caches are the case that actually bites: they are keyed by the resource
      // alone, yet carry private content and a per-caller `capabilities` block, so
      // within `gcTime` a second user on the same browser would be served the
      // first user's answer as a settled `success`.
      const authorizationSensitiveKeys = [
        orpc.sharing.listGrants.key(),
        orpc.sharing.searchGranteeOrganizations.key(),
        orpc.users.listInvitations.key(),
        ...allResourceCacheFamilies(),
      ];
      for (const queryKey of authorizationSensitiveKeys) {
        queryClient.removeQueries({ queryKey });
      }

      // Revalidate Next.js cache
      await revalidateAuth();
    },
  });
}
