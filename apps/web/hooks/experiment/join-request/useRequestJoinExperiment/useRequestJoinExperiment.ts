import { orpc } from "@/lib/orpc";
import { parseApiError } from "@/util/apiError";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

export type UseRequestJoinExperimentOptions = Pick<
  ReturnType<typeof orpc.experiments.createJoinRequest.mutationOptions>,
  "onSuccess" | "onError"
>;

export const useRequestJoinExperiment = (options?: UseRequestJoinExperimentOptions) => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation(
    orpc.experiments.createJoinRequest.mutationOptions({
      onSuccess: async (...args) => {
        const [, variables] = args;
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.getMyJoinRequest.key(),
        });
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.listJoinRequests.key({ input: { id: variables.id } }),
        });
        toast({ description: t("experimentSettings.requestSubmitted") });
        options?.onSuccess?.(...args);
      },
      onError: (...args) => {
        const [error] = args;
        toast({
          description:
            parseApiError(error)?.message ?? t("experimentSettings.requestSubmittedError"),
          variant: "destructive",
        });
        options?.onError?.(...args);
      },
    }),
  );
};
