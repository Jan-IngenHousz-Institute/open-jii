import { listQueryKeys } from "@/hooks/list-query-keys";
import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { Protocol } from "@repo/api/domains/protocol/protocol.schema";

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
        for (const queryKey of listQueryKeys.protocols()) {
          await queryClient.cancelQueries({ queryKey });
        }

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
        for (const queryKey of listQueryKeys.protocols()) {
          await queryClient.invalidateQueries({ queryKey });
        }
        // Editing shared protocol code changes workbook drift; refetch so an
        // attached experiment's upgrade prompt reacts immediately.
        await queryClient.invalidateQueries({ queryKey: orpc.workbooks.key() });
      },
      onSuccess: (data) => {
        props.onSuccess?.(data);
      },
    }),
  );
};
