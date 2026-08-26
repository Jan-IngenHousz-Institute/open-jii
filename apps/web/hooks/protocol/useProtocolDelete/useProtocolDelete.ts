import { listQueryKeys } from "@/hooks/list-query-keys";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

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
  const queryClient = useQueryClient();

  return useMutation(
    orpc.protocols.deleteProtocol.mutationOptions({
      onSettled: async () => {
        // Refetch the lists after success/error to keep the cache in sync.
        for (const queryKey of listQueryKeys.protocols()) {
          await queryClient.invalidateQueries({ queryKey });
        }
      },
      onSuccess: () => {
        // Drop the deleted protocol's detail cache.
        queryClient.removeQueries({
          queryKey: orpc.protocols.getProtocol.queryKey({ input: { id: protocolId } }),
        });
        props.onSuccess?.();
      },
    }),
  );
};
