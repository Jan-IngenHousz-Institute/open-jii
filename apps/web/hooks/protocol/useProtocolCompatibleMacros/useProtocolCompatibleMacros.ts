import { tsr } from "../../../lib/tsr";

/**
 * Hook to fetch compatible macros for a protocol
 * @param protocolId The protocol ID
 * @param enabled Whether to enable the query (default: true)
 */
export const useProtocolCompatibleMacros = (protocolId: string, enabled = true) => {
  return tsr.protocols.listCompatibleMacros.useQuery({
    queryData: { params: { id: protocolId } },
    queryKey: ["protocol-compatible-macros", protocolId],
    enabled: enabled && !!protocolId,
  });
};
