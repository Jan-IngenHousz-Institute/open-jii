import { useMutation, useQueryClient } from "@tanstack/react-query";

import { orpc } from "@/lib/orpc";

/**
 * Hook to add compatible macros to a protocol
 * @param protocolId The protocol ID (used for cache invalidation)
 */
export const useAddCompatibleMacro = (protocolId: string) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.protocols.addCompatibleMacros.mutationOptions({
      onSettled: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpc.protocols.listCompatibleMacros.queryKey({ input: { id: protocolId } }),
        });
      },
    }),
  );
};
