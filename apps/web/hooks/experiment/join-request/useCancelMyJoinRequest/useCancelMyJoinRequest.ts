import { orpc } from "@/lib/orpc";
import { parseApiError } from "@/util/apiError";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

export type UseCancelMyJoinRequestOptions = Pick<
  ReturnType<typeof orpc.experiments.cancelJoinRequest.mutationOptions>,
  "onSuccess" | "onError"
>;

export const useCancelMyJoinRequest = (options?: UseCancelMyJoinRequestOptions) => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation(
    orpc.experiments.cancelJoinRequest.mutationOptions({
      onSuccess: async (...args) => {
        const [, variables] = args;
        queryClient.removeQueries({ queryKey: orpc.experiments.getMyJoinRequest.key() });
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.listJoinRequests.key({ input: { id: variables.id } }),
        });
        toast({ description: t("experimentSettings.requestCancelled") });
        options?.onSuccess?.(...args);
      },
      onError: (...args) => {
        const [error] = args;
        toast({
          description:
            parseApiError(error)?.message ?? t("experimentSettings.requestCancelledError"),
          variant: "destructive",
        });
        options?.onError?.(...args);
      },
    }),
  );
};
