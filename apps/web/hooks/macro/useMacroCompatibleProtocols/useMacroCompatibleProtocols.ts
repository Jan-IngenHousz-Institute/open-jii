import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook to fetch compatible protocols for a macro
 * @param macroId The macro ID
 * @param enabled Whether to enable the query (default: true)
 */
export const useMacroCompatibleProtocols = (macroId: string, enabled = true) => {
  return useQuery(
    orpc.macros.listCompatibleProtocols.queryOptions({
      input: { id: macroId },
      enabled: enabled && !!macroId,
    }),
  );
};
