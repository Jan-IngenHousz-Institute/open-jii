import { tsr } from "../../../lib/tsr";

/**
 * Hook to fetch compatible protocols for a specific macro version.
 * Without version, returns protocols compatible with the latest version.
 */
export const useMacroCompatibleProtocols = (
  macroId: string,
  enabled = true,
  version?: number,
) => {
  return tsr.macros.listCompatibleProtocols.useQuery({
    queryData: { params: { id: macroId }, query: { version } },
    queryKey: ["macro-compatible-protocols", macroId, version],
    enabled: enabled && !!macroId,
  });
};
