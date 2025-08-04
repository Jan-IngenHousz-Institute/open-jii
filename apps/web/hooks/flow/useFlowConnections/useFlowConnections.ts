import { useQuery } from "@tanstack/react-query";

// Define the expected connection type based on the API schema
interface FlowStepConnection {
  id: string;
  flowId: string;
  sourceStepId: string;
  targetStepId: string;
  type: "default";
  animated: false;
  condition?: Record<string, unknown>;
  priority: number;
}

/**
 * Hook to fetch flow connections (edges) by flow ID
 * @param flowId The ID of the flow to fetch connections for
 * @returns Query result containing the flow connections
 */
export const useFlowConnections = (flowId: string) => {
  return useQuery({
    queryKey: ["flowConnections", flowId],
    queryFn: (): Promise<{ status: number; body: FlowStepConnection[] }> => {
      // TODO: Replace with actual API call when endpoint is available
      // For now, return empty connections since there's no dedicated endpoint
      // The backend has getFlowWithConnections but it's not exposed via API yet
      
      // When the API endpoint is available, this should be:
      // return tsr.flows.getFlowConnections.useQuery({
      //   queryData: { params: { id: flowId } }
      // });
      
      console.log("Fetching connections for flow:", flowId);
      return Promise.resolve({
        status: 200,
        body: [] as FlowStepConnection[], // Empty array for now
      });
    },
    enabled: !!flowId,
  });
};