import { tsr } from "@/lib/tsr";

/**
 * Hook to fetch a single flow by ID
 * @param flowId The ID of the flow to fetch
 * @returns Query result containing the flow details
 */
export const useFlow = (flowId: string) => {
  return tsr.flows.getFlow.useQuery({
    queryData: { params: { id: flowId } },
    queryKey: ["flow", flowId],
  });
};
