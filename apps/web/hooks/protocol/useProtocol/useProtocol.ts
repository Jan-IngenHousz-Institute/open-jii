import { tsr } from "../../../lib/tsr";

/**
 * Hook to fetch a single protocol by ID
 * @param protocolId The ID of the protocol to fetch
 * @returns Query result containing the protocol details
 */
export const useProtocol = (protocolId: string) => {
  return tsr.protocols.getProtocol.useQuery({
    queryData: { params: { id: protocolId } },
    queryKey: ["protocol", protocolId],
  });
};
