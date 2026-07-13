import { tsr } from "../../../lib/tsr";

/**
 * Hook to add compatible commands to a macro
 * @param macroId The macro ID (used for cache invalidation)
 */
export const useAddCompatibleCommand = (macroId: string) => {
  const queryClient = tsr.useQueryClient();

  return tsr.macros.addCompatibleCommands.useMutation({
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["macro-compatible-commands", macroId],
      });
    },
  });
};
