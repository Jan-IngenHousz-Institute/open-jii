import type { Protocol } from "@repo/api";

import { tsr } from "../../../lib/tsr";

interface ProtocolDeleteProps {
  onSuccess?: () => void;
}

/**
 * Hook to delete a protocol
 * @param protocolId The ID of the protocol to delete
 * @param props Optional callbacks and configuration
 * @returns Mutation result for deleting a protocol
 */
export const useProtocolDelete = (protocolId: string, props: ProtocolDeleteProps = {}) => {
  const queryClient = tsr.useQueryClient();

  return tsr.protocols.deleteProtocol.useMutation({
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["protocols"] });

      // Get the current protocols
      const previousProtocols = queryClient.getQueryData<{
        body: Protocol[];
      }>(["protocols"]);

      // Optimistically remove the protocol from the list
      if (previousProtocols?.body) {
        queryClient.setQueryData(["protocols"], {
          ...previousProtocols,
          body: previousProtocols.body.filter((protocol) => protocol.id !== protocolId),
        });
      }

      // Return the previous protocols to use in case of error
      return { previousProtocols };
    },
    onError: (error, variables, context) => {
      // If there was an error, revert to the previous state
      if (context?.previousProtocols) {
        queryClient.setQueryData(["protocols"], context.previousProtocols);
      }
    },
    onSettled: async () => {
      // Always refetch after error or success to make sure cache is in sync with server
      await queryClient.invalidateQueries({
        queryKey: ["protocols"],
      });
    },
    onSuccess: () => {
      // Remove the deleted protocol from the cache
      queryClient.removeQueries({
        queryKey: ["protocol", protocolId],
      });

      // Call the provided onSuccess callback if it exists
      if (props.onSuccess) {
        props.onSuccess();
      }
    },
  });
};
