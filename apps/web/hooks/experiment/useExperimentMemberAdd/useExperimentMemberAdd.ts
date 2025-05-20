import type { ExperimentMember } from "@repo/api";

import { tsr } from "../../../lib/tsr";

/**
 * Hook to add a member to an experiment
 * @returns Mutation object for adding members to an experiment
 */
export const useExperimentMemberAdd = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.addExperimentMember.useMutation({
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["experiment-members", variables.params.id],
      });

      // Get current members
      const previousMembers = queryClient.getQueryData<{
        body: ExperimentMember[];
      }>(["experiment-members", variables.params.id]);

      // Create an optimistic new member entry
      const optimisticMember: Partial<ExperimentMember> = {
        // Use a temporary ID that will be replaced with the real one from the server
        id: `temp-${Date.now()}`,
        userId: variables.body.userId,
        role: variables.body.role ?? "member",
        // Use current timestamp as an estimate
        joinedAt: new Date().toISOString(),
      };

      // Optimistically add the new member to the cache
      if (previousMembers?.body) {
        queryClient.setQueryData(["experiment-members", variables.params.id], {
          ...previousMembers,
          body: [...previousMembers.body, optimisticMember],
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
