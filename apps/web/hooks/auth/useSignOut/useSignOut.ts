"use client";

import { myOrganizationInvitationsFamily } from "@/hooks/organization/organization-cache";
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

      // The module-level QueryClient survives sign-out, while resource detail
      // caches are not principal-scoped and carry private content/capabilities.
      // Remove them so the next user cannot receive the old user's settled data.
      const authorizationSensitiveKeys = [
        orpc.sharing.listGrants.key(),
        orpc.sharing.searchGranteeOrganizations.key(),
        orpc.users.listInvitations.key(),
        orpc.experiments.getMyJoinRequest.key(),
        orpc.users.getDeletionBlockers.key(),
        orpc.search.globalSearch.key(),
        // The signed-out user's own pending invitations name the organizations that
        // asked for them; invalidating the `auth` namespace would leave them readable.
        myOrganizationInvitationsFamily(),
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
