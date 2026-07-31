import { getOrpcError, orpc } from "@/lib/orpc";
import { parseApiError } from "@/util/apiError";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

type UseTransferResourceAdminOptions = Pick<
  ReturnType<typeof orpc.sharing.transferResourceAdmin.mutationOptions>,
  "onSuccess" | "onError" | "onSettled"
>;

/** Bulk-transfers admin rights and refreshes deletion-blocker caches. */
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
        // Bulk transfer spans resources, so invalidate each entire query family.
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
