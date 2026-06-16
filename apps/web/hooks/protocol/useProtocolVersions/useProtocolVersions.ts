import { tsr } from "../../../lib/tsr";

/** Version history for a protocol (newest first), for the history/restore UI. */
export const useProtocolVersions = (protocolId: string, options?: { enabled?: boolean }) => {
  return tsr.protocols.listProtocolVersions.useQuery({
    queryData: { params: { id: protocolId } },
    queryKey: ["protocolVersions", protocolId],
    enabled: options?.enabled ?? !!protocolId,
  });
};
