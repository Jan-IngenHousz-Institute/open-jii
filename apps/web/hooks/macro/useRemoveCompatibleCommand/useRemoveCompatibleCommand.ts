import { tsr } from "../../../lib/tsr";

/**
 * Hook to remove a compatible command from a macro
 * @param macroId The macro ID (used for cache invalidation)
 */
export const useRemoveCompatibleCommand = (macroId: string) => {
  const queryClient = tsr.useQueryClient();

  return tsr.macros.removeCompatibleCommand.useMutation({
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["macro-compatible-commands", macroId],
      });
    },
  });
};
