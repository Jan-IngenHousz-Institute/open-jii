import { tsr } from "@/lib/tsr";

/**
 * Hook to fetch a complete flow with steps and connections in a single call
 * @param flowId The ID of the flow to fetch
 * @returns Query result containing the flow with steps and connections
 */
export const useFlowWithGraph = (flowId: string) => {
  return tsr.flows.getFlowWithGraph.useQuery({
    queryData: { params: { id: flowId } },
    queryKey: ["flowWithGraph", flowId],
    enabled: !!flowId,
  });
};
