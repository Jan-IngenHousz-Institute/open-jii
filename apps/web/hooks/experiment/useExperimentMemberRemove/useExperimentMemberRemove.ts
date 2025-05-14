import { tsrWithToasts } from "@/lib/tsr-with-toasts";

import type { ExperimentMember } from "@repo/api";

/**
 * Hook to remove a member from an experiment
 * @returns Mutation object for removing members from an experiment
 */
export const useExperimentMemberRemove = () => {
  const queryClient = tsrWithToasts.useQueryClient();

  return tsrWithToasts.experiments.removeExperimentMember.useMutation({
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: [
          "experiment-members",
          variables.params.id,
          variables.query.userId,
        ],
      });

      // Get current members
      const previousMembers = queryClient.getQueryData<{
        body: ExperimentMember[];
      }>(["experiment-members", variables.params.id, variables.query.userId]);

      // Optimistically remove the member from the cache
      if (previousMembers?.body) {
        queryClient.setQueryData(
          ["experiment-members", variables.params.id, variables.query.userId],
          {
            ...previousMembers,
            body: previousMembers.body.filter(
              (member) => member.userId !== variables.params.memberId,
            ),
          },
        );
      }

      return { previousMembers };
    },
    onError: (error, variables, context) => {
      // Revert to previous state on error
      if (context?.previousMembers) {
        queryClient.setQueryData(
          ["experiment-members", variables.params.id, variables.query.userId],
          context.previousMembers,
        );
      }
      // The toast notification is automatically shown by tsrWithToasts
    },
    onSettled: async (data, error, variables) => {
      // Always refetch to ensure cache is in sync with server
      await queryClient.invalidateQueries({
        queryKey: [
          "experiment-members",
          variables.params.id,
          variables.query.userId,
        ],
      });
    },
  });
};
