import { getOrpcError, orpc } from "@/lib/orpc";
import { parseApiError } from "@/util/apiError";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

export type UseRejectJoinRequestOptions = Pick<
  ReturnType<typeof orpc.experiments.rejectJoinRequest.mutationOptions>,
  "onSuccess" | "onError" | "onSettled"
>;

export const useRejectJoinRequest = (options?: UseRejectJoinRequestOptions) => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation(
    orpc.experiments.rejectJoinRequest.mutationOptions({
      onSuccess: (...args) => {
        toast({ description: t("experimentSettings.joinRequestRejected") });
        options?.onSuccess?.(...args);
      },
      onError: (...args) => {
        const [error] = args;
        const orpcError = getOrpcError(error);
        toast({
          description:
            parseApiError(orpcError?.data)?.message ??
            t("experimentSettings.joinRequestRejectedError"),
          variant: "destructive",
        });
        options?.onError?.(...args);
      },
      onSettled: async (...args) => {
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.listJoinRequests.key(),
        });
        options?.onSettled?.(...args);
      },
    }),
  );
};
