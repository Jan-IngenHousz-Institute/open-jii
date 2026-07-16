import { orpc } from "@/lib/orpc";
import { parseApiError } from "@/util/apiError";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

export type UseApproveJoinRequestOptions = Pick<
  ReturnType<typeof orpc.experiments.approveJoinRequest.mutationOptions>,
  "onSuccess" | "onError" | "onSettled"
>;

export const useApproveJoinRequest = (options?: UseApproveJoinRequestOptions) => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation(
    orpc.experiments.approveJoinRequest.mutationOptions({
      onSuccess: (...args) => {
        toast({ description: t("experimentSettings.joinRequestApproved") });
        options?.onSuccess?.(...args);
      },
      onError: (...args) => {
        const [error] = args;
        toast({
          description:
            parseApiError(error)?.message ?? t("experimentSettings.joinRequestApprovedError"),
          variant: "destructive",
        });
        options?.onError?.(...args);
      },
      onSettled: async (...args) => {
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.listJoinRequests.key(),
        });
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.listExperimentMembers.key(),
        });
        options?.onSettled?.(...args);
      },
    }),
  );
};
