import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner-native";
import { orpc } from "~/shared/api/orpc";
import { useTranslation } from "~/shared/i18n";

// The global `QueryCache.onError` covers queries only, so a mutation that
// toasts nowhere fails silently.
export function useRequestJoinOrganization(organizationName: string) {
  const queryClient = useQueryClient();
  const { t } = useTranslation(["common", "organizations"]);

  const mutation = useMutation(
    orpc.organizations.createOrganizationJoinRequest.mutationOptions({
      onSuccess: () => {
        toast.success(t("organizations:join.sent", { name: organizationName }));
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
    requestJoin: mutation.mutate,
    requestJoinAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}
