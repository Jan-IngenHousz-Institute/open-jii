import { orpc } from "@/lib/orpc";
import { parseApiError } from "@/util/apiError";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTranslation } from "@repo/i18n";
import { toast } from "@repo/ui/hooks/use-toast";

export type UseCreateExperimentJoinCodeOptions = Pick<
  ReturnType<typeof orpc.experiments.createJoinCode.mutationOptions>,
  "onSuccess" | "onError" | "onSettled"
>;

export const useCreateExperimentJoinCode = (options?: UseCreateExperimentJoinCodeOptions) => {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  return useMutation(
    orpc.experiments.createJoinCode.mutationOptions({
      onSuccess: (...args) => {
        toast({ description: t("joinCode.created") });
        options?.onSuccess?.(...args);
      },
      onError: (...args) => {
        const [error] = args;
        toast({
          description: parseApiError(error)?.message ?? t("joinCode.createFailed"),
          variant: "destructive",
        });
        options?.onError?.(...args);
      },
      onSettled: async (...args) => {
        const [, , variables] = args;
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.getJoinCode.key({ input: { id: variables.id } }),
        });
        options?.onSettled?.(...args);
      },
    }),
  );
};
