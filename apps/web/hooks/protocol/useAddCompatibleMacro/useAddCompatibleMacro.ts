import { tsr } from "../../../lib/tsr";

/**
 * Hook to add compatible macros to a protocol
 * @param protocolId The protocol ID (used for cache invalidation)
 */
export const useAddCompatibleMacro = (protocolId: string) => {
  const queryClient = tsr.useQueryClient();

  return tsr.protocols.addCompatibleMacros.useMutation({
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["protocol-compatible-macros", protocolId],
      });
    },
  });
};
