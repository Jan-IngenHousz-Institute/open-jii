import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type UseCancelMyOrganizationJoinRequestOptions = Pick<
  ReturnType<typeof orpc.organizations.cancelMyOrganizationJoinRequest.mutationOptions>,
  "onSuccess" | "onError" | "onSettled"
>;

/** Withdraw the caller's own pending request, returning the CTA to "Join". */
export const useCancelMyOrganizationJoinRequest = (
  options?: UseCancelMyOrganizationJoinRequestOptions,
) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.organizations.cancelMyOrganizationJoinRequest.mutationOptions({
      ...options,
      onSettled: async (...args) => {
        await queryClient.invalidateQueries({
          queryKey: orpc.organizations.listOrganizations.key(),
        });
        await queryClient.invalidateQueries({
          queryKey: orpc.organizations.getOrganization.key(),
        });
        await queryClient.invalidateQueries({
          queryKey: orpc.organizations.listOrganizationJoinRequests.key(),
        });
        await options?.onSettled?.(...args);
      },
    }),
  );
};
