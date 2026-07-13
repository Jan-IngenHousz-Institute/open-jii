import { tsr } from "../../../lib/tsr";

/**
 * Hook to remove a compatible macro from a command
 * @param commandId The command ID (used for cache invalidation)
 */
export const useRemoveCompatibleMacro = (commandId: string) => {
  const queryClient = tsr.useQueryClient();

  return tsr.commands.removeCompatibleMacro.useMutation({
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["command-compatible-macros", commandId],
      });
    },
  });
};
