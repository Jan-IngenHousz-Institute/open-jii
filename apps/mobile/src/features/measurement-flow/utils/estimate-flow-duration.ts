import type { FlowNode } from "~/shared/measurements/flow-node";

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
  branch: 0,
};

export function estimateFlowDuration(nodes: FlowNode[]): number {
  if (nodes.length === 0) return 0;
  const sum = nodes.reduce((acc, n) => {
    // An inline command rides the measurement node but runs in seconds, not the
    // ~1.5 min a command scan takes.
    if (n.type === "measurement" && n.content?.command) return acc;
    return acc + (NODE_MINUTES[n.type] ?? 0);
  }, 0);
  return Math.max(1, Math.round(sum));
}
