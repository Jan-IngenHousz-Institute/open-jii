import type { Protocol } from "@repo/api";

import { tsr } from "../../../lib/tsr";

interface ProtocolCreateProps {
  onSuccess?: (id: string) => void;
}

/**
 * Hook to create a new protocol
 * @param props Optional callbacks and configuration
 * @returns Mutation result for creating a protocol
 */
export const useProtocolCreate = (props: ProtocolCreateProps = {}) => {
  const queryClient = tsr.useQueryClient();

  return tsr.protocols.createProtocol.useMutation({
    onMutate: async () => {
      // Cancel any outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ["protocols"] });

      // Get the current protocols
      const previousProtocols = queryClient.getQueryData<{
        body: Protocol[];
      }>(["protocols"]);

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
    onSuccess: (data) => {
      // Call the provided onSuccess callback if it exists
      if (props.onSuccess) {
        props.onSuccess(data.body.id);
      }
    },
  });
};
