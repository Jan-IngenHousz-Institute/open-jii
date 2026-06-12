import { parseApiError } from "@/shared/api/apiError";
import { getContractError, tsr } from "@/shared/api/tsr";
import type { TsRestMutationOptions, TsrRoute } from "@/shared/api/tsr";

import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

const route = tsr.experiments.cancelJoinRequest;

export type UseCancelMyJoinRequestOptions = TsRestMutationOptions<
  TsrRoute<typeof route>,
  "onSuccess" | "onError"
>;

export const useCancelMyJoinRequest = (options?: UseCancelMyJoinRequestOptions) => {
  const queryClient = tsr.useQueryClient();
  const { t } = useTranslation();

  return route.useMutation({
    ...options,
    onSuccess: async (...args) => {
      const [, variables] = args;
      queryClient.removeQueries({ queryKey: ["experiment-join-request-mine"] });
      await queryClient.invalidateQueries({
        queryKey: ["experiment-join-requests", variables.params.id],
      });
      toast({ description: t("experimentSettings.requestCancelled") });
      options?.onSuccess?.(...args);
    },
    onError: (error, ...rest) => {
      toast({
        description: parseApiError(error)?.message ?? t("experimentSettings.requestCancelledError"),
        variant: "destructive",
      });
      const contractError = getContractError(route, error);
      if (contractError) {
        options?.onError?.(contractError, ...rest);
      }
    },
  });
};
