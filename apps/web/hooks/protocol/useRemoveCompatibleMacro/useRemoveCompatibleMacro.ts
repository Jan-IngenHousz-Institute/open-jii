import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ProtocolMacroList } from "@repo/api/domains/protocol/protocol.schema";

/**
 * Hook to remove a compatible macro from a protocol. The row leaves the list at
 * once and comes back if the server refuses.
 * @param protocolId The protocol ID (used for cache invalidation)
 */
export const useRemoveCompatibleMacro = (protocolId: string) => {
  const queryClient = useQueryClient();
  const listKey = orpc.protocols.listCompatibleMacros.queryKey({ input: { id: protocolId } });

  return useMutation(
    orpc.protocols.removeCompatibleMacro.mutationOptions({
      onMutate: async ({ macroId }) => {
        await queryClient.cancelQueries({ queryKey: listKey });

        const previousList = queryClient.getQueryData<ProtocolMacroList>(listKey);
        if (previousList) {
          queryClient.setQueryData(
            listKey,
            previousList.filter((entry) => entry.macro.id !== macroId),
          );
        }

        return { previousList };
      },
      onError: (_error, _variables, context) => {
        if (context?.previousList) {
          queryClient.setQueryData(listKey, context.previousList);
        }
      },
      onSettled: async () => {
        await queryClient.invalidateQueries({ queryKey: listKey });
      },
    }),
  );
};
