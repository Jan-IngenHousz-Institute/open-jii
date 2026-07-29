"use client";

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
      // signed-out user's grants, organizations, invitee emails and resolved
      // capabilities resident in a module-level QueryClient. Their keys carry the
      // principal, so the next user could not have read them anyway (see
      // `principal-query-key`) — this just stops them lingering.
      queryClient.removeQueries({ queryKey: orpc.sharing.listGrants.key() });
      queryClient.removeQueries({ queryKey: orpc.sharing.searchGranteeOrganizations.key() });
      queryClient.removeQueries({ queryKey: orpc.users.listInvitations.key() });
      queryClient.removeQueries({ queryKey: orpc.experiments.getExperimentAccess.key() });

      // Revalidate Next.js cache
      await revalidateAuth();
    },
  });
}
