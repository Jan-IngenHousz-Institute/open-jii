import { tsr } from "../../../lib/tsr";

/**
 * Hook to fetch compatible commands for a macro
 * @param macroId The macro ID
 * @param enabled Whether to enable the query (default: true)
 */
export const useMacroCompatibleCommands = (macroId: string, enabled = true) => {
  return tsr.macros.listCompatibleCommands.useQuery({
    queryData: { params: { id: macroId } },
    queryKey: ["macro-compatible-commands", macroId],
    enabled: enabled && !!macroId,
  });
};
