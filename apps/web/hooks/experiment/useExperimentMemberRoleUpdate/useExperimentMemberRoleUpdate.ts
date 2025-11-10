import { tsr } from "@/lib/tsr";

import type { ExperimentMember } from "@repo/api";

/**
 * Hook to update a member's role in an experiment
 * @returns Mutation object for updating a member's role
 */
export const useExperimentMemberRoleUpdate = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.updateExperimentMemberRole.useMutation({
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["experiment-members", variables.params.id],
      });

      // Get current members
      const previousMembers = queryClient.getQueryData<{
        body: ExperimentMember[];
      }>(["experiment-members", variables.params.id]);

      // Optimistically update the member's role in the cache
      if (previousMembers?.body) {
        queryClient.setQueryData(["experiment-members", variables.params.id], {
          ...previousMembers,
          body: previousMembers.body.map((member) =>
            member.user.id === variables.params.memberId
              ? { ...member, role: variables.body.role }
              : member,
          ),
        });
      }

      return { previousMembers };
    },
    onError: (error, variables, context) => {
      // Revert to previous state on error
      if (context?.previousMembers) {
        queryClient.setQueryData(
          ["experiment-members", variables.params.id],
          context.previousMembers,
        );
      }
    },
    onSettled: async (data, error, variables) => {
      // Always refetch to ensure cache is in sync with server
      await queryClient.invalidateQueries({
        queryKey: ["experiment-members", variables.params.id],
      });
    },
  });
};
