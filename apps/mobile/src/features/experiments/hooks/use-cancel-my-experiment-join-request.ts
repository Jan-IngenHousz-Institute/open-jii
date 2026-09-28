import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner-native";
import { orpc } from "~/shared/api/orpc";
import { useTranslation } from "~/shared/i18n";

export function useCancelMyExperimentJoinRequest() {
  const queryClient = useQueryClient();
  const { t } = useTranslation(["common", "experiments"]);

  const mutation = useMutation(
    orpc.experiments.cancelJoinRequest.mutationOptions({
      onSuccess: () => {
        toast.success(t("experiments:join.cancelled"));
      },
      onError: (error) => {
        toast.error(error?.message || t("common:errorGeneric"));
      },
      onSettled: () =>
        Promise.all([
          queryClient.invalidateQueries({
            queryKey: orpc.experiments.getExperimentAccess.key(),
          }),
          queryClient.invalidateQueries({
            queryKey: orpc.experiments.getMyJoinRequest.key(),
          }),
          queryClient.invalidateQueries({
            queryKey: orpc.experiments.listExperiments.key(),
          }),
        ]),
    }),
  );

  return {
    cancelRequest: mutation.mutate,
    isPending: mutation.isPending,
  };
}
