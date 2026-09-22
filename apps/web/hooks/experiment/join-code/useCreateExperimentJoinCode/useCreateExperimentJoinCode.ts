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
      // No success toast: the dialog that owns this mutation shows the outcome
      // itself, and a toast mounts a dismissable layer that steals the next Escape
      // from the open dialog. Errors keep theirs — they have no other surface.
      onSuccess: options?.onSuccess,
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
