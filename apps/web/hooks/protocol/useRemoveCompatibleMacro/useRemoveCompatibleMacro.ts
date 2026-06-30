import { orpc } from "@/lib/orpc";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Hook to remove a compatible macro from a protocol
 * @param protocolId The protocol ID (used for cache invalidation)
 */
export const useRemoveCompatibleMacro = (protocolId: string) => {
  const queryClient = useQueryClient();

  return useMutation(
    orpc.protocols.removeCompatibleMacro.mutationOptions({
      onSettled: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpc.protocols.listCompatibleMacros.queryKey({ input: { id: protocolId } }),
        });
      },
    }),
  );
};
