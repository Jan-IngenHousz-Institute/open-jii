import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook to fetch compatible macros for a protocol
 * @param protocolId The protocol ID
 * @param enabled Whether to enable the query (default: true)
 */
export const useProtocolCompatibleMacros = (protocolId: string, enabled = true) => {
  return useQuery(
    orpc.protocols.listCompatibleMacros.queryOptions({
      input: { id: protocolId },
      enabled: enabled && !!protocolId,
    }),
  );
};
