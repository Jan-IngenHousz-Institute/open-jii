import { tsr } from "../../../lib/tsr";

/**
 * Hook to remove a compatible macro from a protocol
 * @param protocolId The protocol ID (used for cache invalidation)
 */
export const useRemoveCompatibleMacro = (protocolId: string) => {
  const queryClient = tsr.useQueryClient();

  return tsr.protocols.removeCompatibleMacro.useMutation({
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["protocol-compatible-macros", protocolId],
      });
    },
  });
};
