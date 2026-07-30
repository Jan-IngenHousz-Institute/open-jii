import { getOrpcError, orpc } from "@/lib/orpc";
import { parseApiError } from "@/util/apiError";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

export type UseTransferResourceAdminOptions = Pick<
  ReturnType<typeof orpc.sharing.transferResourceAdmin.mutationOptions>,
  "onSuccess" | "onError" | "onSettled"
>;

/**
 * Bulk-transfers admin rights to other users (one target per resource), across any
 * of the shareable resource types. Used to clear account-deletion blockers in a
 * single call. Surfaces success/partial/error toasts itself and invalidates the
 * deletion-blocker, collaborator and contributor caches so resolved resources drop
 * out of the delete dialog automatically.
 */
export const useTransferResourceAdmin = (options?: UseTransferResourceAdminOptions) => {
  const queryClient = useQueryClient();
  const { t } = useTranslation("account");

  return useMutation(
    orpc.sharing.transferResourceAdmin.mutationOptions({
      ...options,
      onSuccess: (...args) => {
        const [data] = args;
        const hasFailures = data.results.some((result) => !result.success);
        if (hasFailures) {
          toast({
            description: t("dangerZone.delete.blockers.transferPartial"),
            variant: "destructive",
          });
        } else {
          toast({ description: t("dangerZone.delete.blockers.transferSuccess") });
        }
        options?.onSuccess?.(...args);
      },
      onError: (error, ...rest) => {
        const orpcError = getOrpcError(error);
        toast({
          description:
            parseApiError(error)?.message ?? t("dangerZone.delete.blockers.transferError"),
          variant: "destructive",
        });
        if (orpcError) {
          options?.onError?.(orpcError, ...rest);
        }
      },
      onSettled: async (...args) => {
        // Bulk transfer spans several resources and users, so invalidate every
        // instance of each query (prefix match, no input) rather than one id.
        await queryClient.invalidateQueries({
          queryKey: orpc.users.getDeletionBlockers.key(),
        });
        await queryClient.invalidateQueries({
          queryKey: orpc.sharing.listGrants.key(),
        });
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.listExperimentContributors.key(),
        });
        options?.onSettled?.(...args);
      },
    }),
  );
};
