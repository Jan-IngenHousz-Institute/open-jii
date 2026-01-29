import type { Protocol } from "@repo/api";

import { tsr } from "../../../lib/tsr";

interface ProtocolUpdateProps {
  onSuccess?: (protocol: Protocol) => void;
}

/**
 * Hook to update an existing protocol
 * @param protocolId The ID of the protocol to update
 * @param props Optional callbacks and configuration
 * @returns Mutation result for updating a protocol
 */
export const useProtocolUpdate = (protocolId: string, props: ProtocolUpdateProps = {}) => {
  const queryClient = tsr.useQueryClient();

  return tsr.protocols.updateProtocol.useMutation({
    onMutate: async () => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["protocol", protocolId] });
      await queryClient.cancelQueries({ queryKey: ["protocols"] });

      // Get the current protocol
      const previousProtocol = queryClient.getQueryData<{
        body: Protocol;
      }>(["protocol", protocolId]);

      // Return the previous protocol to use in case of error
      return { previousProtocol };
    },
    onError: (error, variables, context) => {
      // If there was an error, revert to the previous state
      if (context?.previousProtocol) {
        queryClient.setQueryData(["protocol", protocolId], context.previousProtocol);
      }
    },
    onSettled: async () => {
      // Always refetch after error or success to make sure cache is in sync with server
      await queryClient.invalidateQueries({
        queryKey: ["protocol", protocolId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["protocols"],
      });
      // Invalidate breadcrumbs to update entity names
      await queryClient.invalidateQueries({
        queryKey: ["breadcrumbs"],
      });
    },
    onSuccess: (data) => {
      // Call the provided onSuccess callback if it exists
      if (props.onSuccess) {
        props.onSuccess(data.body);
      }
    },
  });
};
