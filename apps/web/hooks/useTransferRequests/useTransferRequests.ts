import { orpc } from "@/lib/orpc";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook to fetch transfer requests for the authenticated user
 * @returns Query result containing the user's transfer requests
 */
export const useTransferRequests = () => {
  return useQuery(orpc.experiments.listTransferRequests.queryOptions({}));
};
