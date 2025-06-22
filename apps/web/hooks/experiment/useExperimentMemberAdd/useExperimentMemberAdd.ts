import { tsr } from "@/lib/tsr";

import type { ExperimentMember } from "@repo/api";

/**
 * Hook to add members to an experiment (batch)
 * @returns Mutation object for adding members to an experiment
 */
export const useExperimentMemberAdd = () => {
  const queryClient = tsr.useQueryClient();

  return tsr.experiments.addExperimentMembers.useMutation({
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["experiment-members", variables.params.id],
      });

      // Get current members
      const previousMembers = queryClient.getQueryData<{
        body: ExperimentMember[];
      }>(["experiment-members", variables.params.id]);

      // Create optimistic new member entries
      const optimisticMembers: Partial<ExperimentMember>[] = variables.body.members.map(
        (member) => ({
          user: {
            id: member.userId,
            name: null,
            email: null,
          },
          role: member.role ?? "member",
          // Use current timestamp as an estimate
          joinedAt: new Date().toISOString(),
        }),
      );

      // Optimistically add the new members to the cache
      if (previousMembers?.body) {
        queryClient.setQueryData(["experiment-members", variables.params.id], {
          ...previousMembers,
          body: [...previousMembers.body, ...optimisticMembers],
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
