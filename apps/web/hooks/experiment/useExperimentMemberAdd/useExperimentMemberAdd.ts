import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ExperimentMember } from "@repo/api/domains/experiment/experiment.schema";

/**
 * Hook to add members to an experiment (batch)
 * @returns Mutation object for adding members to an experiment
 */
export const useExperimentMemberAdd = () => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.experiments.addExperimentMembers.mutationOptions({
      onMutate: async (variables) => {
        const membersKey = orpc.experiments.listExperimentMembers.queryKey({
          input: { id: variables.id },
        });

        // Cancel any outgoing refetches
        await queryClient.cancelQueries({ queryKey: membersKey });

        // Get current members
        const previousMembers = queryClient.getQueryData<ExperimentMember[]>(membersKey);

        // Create optimistic new member entries
        const optimisticMembers: ExperimentMember[] = variables.members.map((member) => ({
          user: {
            id: member.userId,
            firstName: "",
            lastName: "",
            email: null,
            avatarUrl: null,
          },
          role: member.role ?? "member",
          // Use current timestamp as an estimate
          joinedAt: new Date().toISOString(),
        }));

        // Optimistically add the new members to the cache
        if (previousMembers) {
          queryClient.setQueryData(membersKey, [...previousMembers, ...optimisticMembers]);
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
