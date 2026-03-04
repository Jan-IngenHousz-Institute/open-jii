import { tsr } from "../../../lib/tsr";

/**
 * Hook to fetch compatible protocols for a macro
 * @param macroId The macro ID
 * @param enabled Whether to enable the query (default: true)
 */
export const useMacroCompatibleProtocols = (macroId: string, enabled = true) => {
  return tsr.macros.listCompatibleProtocols.useQuery({
    queryData: { params: { id: macroId } },
    queryKey: ["macro-compatible-protocols", macroId],
    enabled: enabled && !!macroId,
  });
};
