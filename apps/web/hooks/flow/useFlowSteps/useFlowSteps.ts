import { tsr } from "@/lib/tsr";

/**
 * Hook to fetch flow steps for a specific flow
 * @param flowId The ID of the flow to fetch steps for
 * @returns Query result containing the flow steps
 */
export const useFlowSteps = (flowId: string) => {
  return tsr.flows.listFlowSteps.useQuery({
    queryData: { params: { id: flowId } },
    queryKey: ["flow", flowId, "steps"],
  });
};
