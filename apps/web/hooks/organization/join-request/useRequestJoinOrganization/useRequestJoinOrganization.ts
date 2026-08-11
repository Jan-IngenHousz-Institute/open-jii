import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type UseRequestJoinOrganizationOptions = Pick<
  ReturnType<typeof orpc.organizations.createOrganizationJoinRequest.mutationOptions>,
  "onSuccess" | "onError" | "onSettled"
>;

/**
 * Ask to join a public organization. The directory row and the profile both carry
 * a `membershipStatus`, so both have to be re-read for the CTA to change.
 */
export const useRequestJoinOrganization = (options?: UseRequestJoinOrganizationOptions) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.organizations.createOrganizationJoinRequest.mutationOptions({
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
