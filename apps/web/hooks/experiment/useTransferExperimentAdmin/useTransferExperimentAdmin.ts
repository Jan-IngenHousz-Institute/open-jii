import { getOrpcError, orpc } from "@/lib/orpc";
import { parseApiError } from "@/util/apiError";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

export type UseTransferExperimentAdminOptions = Pick<
  ReturnType<typeof orpc.experiments.transferExperimentAdmin.mutationOptions>,
  "onSuccess" | "onError" | "onSettled"
>;

/**
 * Bulk-transfers experiment admin rights to other users (one target per experiment). Used to clear
 * account-deletion blockers in a single call. Surfaces success/partial/error toasts itself and
 * invalidates the deletion-blocker and member caches so resolved experiments drop out of the delete
 * dialog automatically.
 */
export const useTransferExperimentAdmin = (options?: UseTransferExperimentAdminOptions) => {
  const queryClient = useQueryClient();
  const { t } = useTranslation("account");

  return useMutation(
    orpc.experiments.transferExperimentAdmin.mutationOptions({
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
            parseApiError(orpcError?.data)?.message ??
            t("dangerZone.delete.blockers.transferError"),
          variant: "destructive",
        });
        if (orpcError) {
          options?.onError?.(orpcError, ...rest);
        }
      },
      onSettled: async (...args) => {
        await queryClient.invalidateQueries({ queryKey: ["deletion-blockers"] });
        await queryClient.invalidateQueries({ queryKey: ["experiment-members"] });
        options?.onSettled?.(...args);
      },
    }),
  );
};
