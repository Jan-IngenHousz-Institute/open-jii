import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { MacroProtocolList } from "@repo/api/domains/macro/macro.schema";

/**
 * Hook to remove a compatible protocol from a macro. The row leaves the list at
 * once and comes back if the server refuses.
 * @param macroId The macro ID (used for cache invalidation)
 */
export const useRemoveCompatibleProtocol = (macroId: string) => {
  const queryClient = useQueryClient();
  const listKey = orpc.macros.listCompatibleProtocols.queryKey({ input: { id: macroId } });

  return useMutation(
    orpc.macros.removeCompatibleProtocol.mutationOptions({
      onMutate: async ({ protocolId }) => {
        await queryClient.cancelQueries({ queryKey: listKey });

        const previousList = queryClient.getQueryData<MacroProtocolList>(listKey);
        if (previousList) {
          queryClient.setQueryData(
            listKey,
            previousList.filter((entry) => entry.protocol.id !== protocolId),
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
