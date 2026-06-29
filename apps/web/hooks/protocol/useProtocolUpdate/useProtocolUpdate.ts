import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Protocol } from "@repo/api/domains/protocol/protocol.schema";

import { orpc } from "@/lib/orpc";

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
  const queryClient = useQueryClient();
  const protocolKey = orpc.protocols.getProtocol.queryKey({ input: { id: protocolId } });

  return useMutation(
    orpc.protocols.updateProtocol.mutationOptions({
      onMutate: async () => {
        await queryClient.cancelQueries({ queryKey: protocolKey });
        await queryClient.cancelQueries({ queryKey: orpc.protocols.listProtocols.key() });

        const previousProtocol = queryClient.getQueryData(protocolKey);
        return { previousProtocol };
      },
      onError: (_error, _variables, context) => {
        if (context?.previousProtocol) {
          queryClient.setQueryData(protocolKey, context.previousProtocol);
        }
      },
      onSettled: async () => {
        await queryClient.invalidateQueries({ queryKey: protocolKey });
        await queryClient.invalidateQueries({ queryKey: orpc.protocols.listProtocols.key() });
      },
      onSuccess: (data) => {
        props.onSuccess?.(data);
      },
    }),
  );
};
