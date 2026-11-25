"use client";

import { useListDeparture } from "@/components/navigation/list-departure/list-departure";
import { myOrganizationInvitationsFamily } from "@/hooks/organization/organization-cache";
import { allResourceCacheFamilies } from "@/hooks/sharing/resource-cache-keys";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { revalidateAuth } from "~/app/actions/revalidate";
import { ACCOUNT_INFO_KEY } from "~/hooks/auth/useAccountInfo/useAccountInfo";
import { LINKED_ACCOUNTS_KEY } from "~/hooks/auth/useLinkedAccounts/useLinkedAccounts";
import { PASSKEYS_KEY } from "~/hooks/auth/usePasskeys/usePasskeys";

import { authClient } from "@repo/auth/client";

/**
 * Hook to sign out
 */
export function useSignOut() {
  const departure = useListDeparture();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      departure?.flush();
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
        // The signed-out person's ways to sign in: their GitHub and ORCID connections, the
        // profiles read for them, and their passkeys.
        LINKED_ACCOUNTS_KEY,
        ACCOUNT_INFO_KEY,
        PASSKEYS_KEY,
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
