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
    retry: (failureCount, error) => {
      // Don't retry on 4xx client errors - these are not transient
      const err = error as unknown;
      if (
        err &&
        typeof err === "object" &&
        "status" in err &&
        typeof err.status === "number" &&
        err.status >= 400 &&
        err.status < 500
      ) {
        return false;
      }
      // Use default retry logic for other errors (up to 3 times)
      return failureCount < 3;
    },
  });
};
