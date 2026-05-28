import { getContractError, tsr } from "@/lib/tsr";
import type { TsRestMutationOptions, TsrRoute } from "@/lib/tsr";
import { parseApiError } from "@/util/apiError";

import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

const route = tsr.experiments.createJoinRequest;

export type UseRequestJoinExperimentOptions = TsRestMutationOptions<
  TsrRoute<typeof route>,
  "onSuccess" | "onError"
>;

export const useRequestJoinExperiment = (options?: UseRequestJoinExperimentOptions) => {
  const queryClient = tsr.useQueryClient();
  const { t } = useTranslation();

  return route.useMutation({
    ...options,
    onSuccess: async (...args) => {
      const [, variables] = args;
      await queryClient.invalidateQueries({ queryKey: ["experiment-join-request-mine"] });
      await queryClient.invalidateQueries({
        queryKey: ["experiment-join-requests", variables.params.id],
      });
      toast({ description: t("experimentSettings.requestSubmitted") });
      options?.onSuccess?.(...args);
    },
    onError: (error, ...rest) => {
      toast({
        description: parseApiError(error)?.message ?? t("experimentSettings.requestSubmittedError"),
        variant: "destructive",
      });
      const contractError = getContractError(route, error);
      if (contractError) {
        options?.onError?.(contractError, ...rest);
      }
    },
  });
};
