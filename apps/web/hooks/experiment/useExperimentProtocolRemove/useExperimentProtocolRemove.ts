import { tsr } from "@/lib/tsr";

import type { ExperimentProtocol } from "@repo/api";

/**
 * Hook to remove a protocol from an experiment, bound to a specific experimentId
 * @param experimentId The ID of the experiment
 * @returns Object with removeProtocol function and mutation state
 */
export const useExperimentProtocolRemove = (experimentId: string) => {
  const queryClient = tsr.useQueryClient();

  const mutation = tsr.experiments.removeExperimentProtocol.useMutation({
    onMutate: async (variables: { params: { id: string; protocolId: string } }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: ["experiment-protocols", experimentId],
      });

      // Get current protocols
      const previousProtocols = queryClient.getQueryData<{
        body: ExperimentProtocol[];
      }>(["experiment-protocols", experimentId]);

      // Optimistically remove the protocol from the cache
      if (previousProtocols?.body) {
        const updated = previousProtocols.body.filter(
          (protocol) => protocol.protocol.id !== variables.params.protocolId,
        );
        queryClient.setQueryData(["experiment-protocols", experimentId], {
          ...previousProtocols,
          body: updated,
        });
      }

      return { previousProtocols };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousProtocols) {
        queryClient.setQueryData(["experiment-protocols", experimentId], context.previousProtocols);
      }
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["experiment-protocols", experimentId],
      });
    },
  });

  const removeProtocol = (protocolId: string) =>
    mutation.mutateAsync({
      params: { id: experimentId, protocolId },
    });

  return { ...mutation, removeProtocol };
};
