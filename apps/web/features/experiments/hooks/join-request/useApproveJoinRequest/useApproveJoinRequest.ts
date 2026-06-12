import { parseApiError } from "@/shared/api/apiError";
import { getContractError, tsr } from "@/shared/api/tsr";
import type { TsRestMutationOptions, TsrRoute } from "@/shared/api/tsr";

import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

const route = tsr.experiments.approveJoinRequest;

export type UseApproveJoinRequestOptions = TsRestMutationOptions<
  TsrRoute<typeof route>,
  "onSuccess" | "onError" | "onSettled"
>;

export const useApproveJoinRequest = (options?: UseApproveJoinRequestOptions) => {
  const queryClient = tsr.useQueryClient();
  const { t } = useTranslation();

  return route.useMutation({
    ...options,
    onSuccess: (...args) => {
      toast({ description: t("experimentSettings.joinRequestApproved") });
      options?.onSuccess?.(...args);
    },
    onError: (error, ...rest) => {
      toast({
        description:
          parseApiError(error)?.message ?? t("experimentSettings.joinRequestApprovedError"),
        variant: "destructive",
      });
      const contractError = getContractError(route, error);
      if (contractError) {
        options?.onError?.(contractError, ...rest);
      }
    },
    onSettled: async (...args) => {
      await queryClient.invalidateQueries({ queryKey: ["experiment-join-requests"] });
      await queryClient.invalidateQueries({ queryKey: ["experiment-members"] });
      options?.onSettled?.(...args);
    },
  });
};
