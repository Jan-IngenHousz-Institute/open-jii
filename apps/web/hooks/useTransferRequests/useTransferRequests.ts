import { tsr } from "@/lib/tsr";

/**
 * Hook to fetch transfer requests for the authenticated user
 * @returns Query result containing the user's transfer requests
 */
export const useTransferRequests = () => {
  return tsr.experiments.listTransferRequests.useQuery({
    queryKey: ["transferRequests"],
  });
};
