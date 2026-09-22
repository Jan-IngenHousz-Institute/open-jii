import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner-native";
import { orpc } from "~/shared/api/orpc";
import { useTranslation } from "~/shared/i18n";

// The global `QueryCache.onError` covers queries only, so a mutation that
// toasts nowhere fails silently.
export function useRequestJoinExperiment(experimentName: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation(["common", "experiments"]);

  const mutation = useMutation(
    orpc.experiments.createJoinRequest.mutationOptions({
      onSuccess: () => {
        toast.success(t("experiments:join.sent", { name: experimentName }));
      },
      onError: (error) => {
        toast.error(error?.message || t("common:errorGeneric"));
      },
      // On settle, not on success: a 409 "already has access" means the cached
      // membership status was stale, and a refetch is the fix.
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
    requestJoin: mutation.mutate,
    isPending: mutation.isPending,
  };
}
