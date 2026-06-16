import { tsr } from "../../../lib/tsr";

/** How many workbooks reference this protocol, for the "used by N workbooks" warning. */
export const useProtocolUsage = (protocolId: string, options?: { enabled?: boolean }) => {
  return tsr.protocols.getProtocolUsage.useQuery({
    queryData: { params: { id: protocolId } },
    queryKey: ["protocolUsage", protocolId],
    enabled: options?.enabled ?? !!protocolId,
  });
};
