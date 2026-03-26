import { shouldRetryQuery } from "@/util/query-retry";

import { tsr } from "../../../lib/tsr";

/**
 * Hook to fetch a single protocol by ID.
 * Without version, returns the latest version.
 */
export const useProtocol = (protocolId: string, enabled = true, version?: number) => {
  return tsr.protocols.getProtocol.useQuery({
    queryData: { params: { id: protocolId }, query: { version } },
    queryKey: ["protocol", protocolId, version],
    retry: shouldRetryQuery,
    enabled: enabled && !!protocolId,
  });
};
