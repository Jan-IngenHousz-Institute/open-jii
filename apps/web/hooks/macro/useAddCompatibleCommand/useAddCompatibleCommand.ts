import { tsr } from "../../../lib/tsr";

/**
 * Hook to add compatible protocols to a macro
 * @param macroId The macro ID (used for cache invalidation)
 */
export const useAddCompatibleProtocol = (macroId: string) => {
  const queryClient = tsr.useQueryClient();

  return tsr.macros.addCompatibleProtocols.useMutation({
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["macro-compatible-protocols", macroId],
      });
    },
  });
};
