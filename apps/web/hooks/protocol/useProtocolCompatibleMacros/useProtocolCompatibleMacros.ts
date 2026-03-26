import { tsr } from "../../../lib/tsr";

/**
 * Hook to fetch compatible macros for a specific protocol version.
 * Without version, returns macros compatible with the latest version.
 */
export const useProtocolCompatibleMacros = (
  protocolId: string,
  enabled = true,
  version?: number,
) => {
  return tsr.protocols.listCompatibleMacros.useQuery({
    queryData: { params: { id: protocolId }, query: { version } },
    queryKey: ["protocol-compatible-macros", protocolId, version],
    enabled: enabled && !!protocolId,
  });
};
