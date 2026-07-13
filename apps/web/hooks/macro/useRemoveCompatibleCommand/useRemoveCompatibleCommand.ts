import { tsr } from "../../../lib/tsr";

/**
 * Hook to remove a compatible protocol from a macro
 * @param macroId The macro ID (used for cache invalidation)
 */
export const useRemoveCompatibleProtocol = (macroId: string) => {
  const queryClient = tsr.useQueryClient();

  return tsr.macros.removeCompatibleProtocol.useMutation({
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["macro-compatible-protocols", macroId],
      });
    },
  });
};
