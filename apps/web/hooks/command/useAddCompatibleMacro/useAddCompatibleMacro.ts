import { tsr } from "../../../lib/tsr";

/**
 * Hook to add compatible macros to a command
 * @param commandId The command ID (used for cache invalidation)
 */
export const useAddCompatibleMacro = (commandId: string) => {
  const queryClient = tsr.useQueryClient();

  return tsr.commands.addCompatibleMacros.useMutation({
    onSettled: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["command-compatible-macros", commandId],
      });
    },
  });
};
