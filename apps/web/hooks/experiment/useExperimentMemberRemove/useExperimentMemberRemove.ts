import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ExperimentMember } from "@repo/api/domains/experiment/experiment.schema";

/**
 * Hook to remove a member from an experiment
 * @returns Mutation object for removing members from an experiment
 */
export const useExperimentMemberRemove = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.experiments.removeExperimentMember.mutationOptions({
      onMutate: async (variables) => {
        const membersKey = orpc.experiments.listExperimentMembers.queryKey({
          input: { id: variables.id },
        });

        // Cancel any outgoing refetches
        await queryClient.cancelQueries({ queryKey: membersKey });

        // Get current members
        const previousMembers = queryClient.getQueryData<ExperimentMember[]>(membersKey);

        // Optimistically remove the member from the cache
        if (previousMembers) {
          queryClient.setQueryData(
            membersKey,
            previousMembers.filter((member) => member.user.id !== variables.memberId),
          );
        }

        return { previousMembers };
      },
      onError: (_error, variables, context) => {
        // Revert to previous state on error
        if (context?.previousMembers) {
          queryClient.setQueryData(
            orpc.experiments.listExperimentMembers.queryKey({ input: { id: variables.id } }),
            context.previousMembers,
          );
        }
      },
      onSettled: async (_data, _error, variables) => {
        // Always refetch to ensure cache is in sync with server
        await queryClient.invalidateQueries({
          queryKey: orpc.experiments.listExperimentMembers.queryKey({
            input: { id: variables.id },
          }),
        });
      },
    }),
  );
};
