import type { FlowNode, ParallelContent } from "~/shared/measurements/flow-node";

/**
 * Rough duration estimate for a measurement flow, in minutes. The numbers
 * below are heuristics (the API does not yet expose a real duration) and
 * are intentionally conservative so users see something close to or slightly
 * above reality rather than under-estimating.
 */
const NODE_MINUTES: Record<FlowNode["type"], number> = {
  instruction: 0.5,
  question: 0.5,
  measurement: 1.5,
  analysis: 0.5,
  parallel: 0,
  branch: 0,
};

function estimatedMinutes(nodes: FlowNode[]): number {
  return nodes.reduce((acc, node) => {
    if (node.type === "measurement" && node.content?.command) return acc;
    if (node.type === "parallel") {
      const lanes = Object.values((node.content as ParallelContent).laneNodes ?? {});
      return acc + Math.max(0, ...lanes.map(estimatedMinutes));
    }
    return acc + NODE_MINUTES[node.type];
  }, 0);
}

export function estimateFlowDuration(nodes: FlowNode[]): number {
  if (nodes.length === 0) return 0;
  // Parallel lanes run together, so the longest lane—not their sum—sets the estimate.
  const sum = estimatedMinutes(nodes);
  return Math.max(1, Math.round(sum));
}
