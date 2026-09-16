import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner-native";
import { orpc } from "~/shared/api/orpc";
import { useTranslation } from "~/shared/i18n";

export function useCancelMyJoinRequest() {
  const queryClient = useQueryClient();
  const { t } = useTranslation(["common", "organizations"]);

  const mutation = useMutation(
    orpc.organizations.cancelMyOrganizationJoinRequest.mutationOptions({
      onSuccess: () => {
        toast.success(t("organizations:join.cancelled"));
      },
      onError: (error) => {
        toast.error(error?.message || t("common:errorGeneric"));
      },
      onSettled: () =>
        Promise.all([
          queryClient.invalidateQueries({
            queryKey: orpc.organizations.listOrganizations.key(),
          }),
          queryClient.invalidateQueries({
            queryKey: orpc.organizations.getOrganization.key(),
          }),
        ]),
    }),
  );

  return {
    cancelRequest: mutation.mutate,
    isPending: mutation.isPending,
  };
}
