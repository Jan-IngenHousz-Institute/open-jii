import { allResourceCacheFamilies } from "@/hooks/sharing/resource-cache-keys";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type UseTransferResourceOrganizationOptions = Pick<
  ReturnType<typeof orpc.sharing.transferResourceOrganization.mutationOptions>,
  "onSuccess" | "onError" | "onSettled"
>;

/**
 * Move a resource to another organization. Everything derived from the owning
 * organization changes at once — the synthesized owner rows on the collaborators
 * list, the caller's own capabilities, which teams may be granted access, and both
 * organizations' resource showcases — so the invalidation is deliberately broad
 * rather than scoped to the one resource.
 *
 * The source organization's team grants are dropped server-side in the same
 * transaction: a team cannot hold access outside the organization it belongs to.
 */
export const useTransferResourceOrganization = (
  options?: UseTransferResourceOrganizationOptions,
) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.sharing.transferResourceOrganization.mutationOptions({
      ...options,
      onSettled: async (...args) => {
        for (const queryKey of [
          ...allResourceCacheFamilies(),
          orpc.sharing.listGrants.key(),
          orpc.organizations.listGranteeTeams.key(),
          orpc.organizations.listOrganizationResources.key(),
          // Transferring the last resource out is exactly what unblocks a pending
          // organization deletion, on both sides of the move.
          orpc.organizations.getOrganizationDeletionBlockers.key(),
        ]) {
          await queryClient.invalidateQueries({ queryKey });
        }
        await options?.onSettled?.(...args);
      },
    }),
  );
};
