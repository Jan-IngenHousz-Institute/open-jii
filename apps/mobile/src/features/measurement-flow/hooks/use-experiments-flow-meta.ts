import { useQueries } from "@tanstack/react-query";
import { estimateFlowDuration } from "~/features/measurement-flow/utils/estimate-flow-duration";
import { orderFlowNodes } from "~/features/measurement-flow/utils/order-flow-nodes";
import { contentKeys } from "~/shared/api/content-query-keys";
import { tsr } from "~/shared/api/tsr";
import { isQuestionsOnlyFlow } from "~/shared/measurements/flow-node";
import type { FlowEdge, FlowNode } from "~/shared/measurements/flow-node";

export interface ExperimentFlowMeta {
  requiresSensor: boolean;
  questionsOnly: boolean;
  nodeCount: number;
  durationMin: number;
}

/**
 * Fetch the per-experiment flow graphs in parallel so the picker cards can
 * render sensor/questions tags and node-count metadata. Uses the
 * ["experiment-flow", id] key so the eventual single-experiment selection
 * hits a warm cache.
 *
 * Note: this fires N concurrent requests. The list endpoint should grow a
 * `flowMeta` field server-side so this prefetch can be retired.
 */
export function useExperimentsFlowMeta(
  experimentIds: string[],
): Record<string, ExperimentFlowMeta> {
  const results = useQueries({
    queries: experimentIds.map((id) => ({
      queryKey: contentKeys.experimentFlow(id),
      queryFn: async () => {
        const res = await tsr.experiments.getFlow.query({ params: { id } });
        return res.status === 200 ? res.body : null;
      },
      enabled: !!id,
    })),
  });

  const out: Record<string, ExperimentFlowMeta> = {};
  results.forEach((r, i) => {
    const id = experimentIds[i];
    const body = r.data;
    if (!id || !body?.graph) return;

    const nodes = orderFlowNodes(
      body.graph.nodes as FlowNode[],
      (body.graph.edges as FlowEdge[]) ?? [],
    );
    const requiresSensor = nodes.some((n) => n.type === "measurement");
    const questionsOnly = isQuestionsOnlyFlow(nodes);
    out[id] = {
      requiresSensor,
      questionsOnly,
      nodeCount: nodes.length,
      durationMin: estimateFlowDuration(nodes),
    };
  });
  return out;
}
