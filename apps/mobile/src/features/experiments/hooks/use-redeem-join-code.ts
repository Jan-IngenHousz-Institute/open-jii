import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner-native";
import { orpc } from "~/shared/api/orpc";
import { useTranslation } from "~/shared/i18n";

export function useRedeemJoinCode(experimentName: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation(["common", "experiments"]);

  const mutation = useMutation(
    orpc.experiments.redeemJoinCode.mutationOptions({
      // A second scan is a success with its own wording, not an error.
      onSuccess: (result) => {
        toast.success(
          result.outcome === "already_member"
            ? t("experiments:joinCode.alreadyMemberToast", { name: experimentName })
            : t("experiments:joinCode.joined", { name: experimentName }),
        );
      },
      onError: (error) => {
        toast.error(error?.message || t("common:errorGeneric"));
      },
      // `listExperiments` is a key prefix over every scope, so one invalidation
      // marks the picker's list, the precache source and the directory stale —
      // which is what makes a freshly joined experiment measurable.
      onSettled: () =>
        Promise.all([
          queryClient.invalidateQueries({
            queryKey: orpc.experiments.listExperiments.key(),
          }),
          queryClient.invalidateQueries({
            queryKey: orpc.experiments.getExperimentAccess.key(),
          }),
          queryClient.invalidateQueries({
            queryKey: orpc.experiments.resolveJoinCode.key(),
          }),
        ]),
    }),
  );

  return {
    redeem: mutation.mutate,
    isPending: mutation.isPending,
  };
}
