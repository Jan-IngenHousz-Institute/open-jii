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
      if (
        typeof error === "object" &&
        "status" in error &&
        typeof error.status === "number" &&
        error.status >= 400 &&
        error.status < 500
      ) {
        return false;
      }
      // Use default retry logic for other errors (up to 3 times)
      return failureCount < 3;
    },
  });
};
