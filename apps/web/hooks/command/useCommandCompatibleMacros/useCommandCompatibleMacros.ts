import { tsr } from "../../../lib/tsr";

/**
 * Hook to fetch compatible macros for a command
 * @param commandId The command ID
 * @param enabled Whether to enable the query (default: true)
 */
export const useCommandCompatibleMacros = (commandId: string, enabled = true) => {
  return tsr.commands.listCompatibleMacros.useQuery({
    queryData: { params: { id: commandId } },
    queryKey: ["command-compatible-macros", commandId],
    enabled: enabled && !!commandId,
  });
};
