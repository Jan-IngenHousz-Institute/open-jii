import type {
  ExperimentFlowGraph,
  ExperimentFlowMeta,
} from "../domains/experiment/experiment.schema";

type FlowNode = ExperimentFlowGraph["nodes"][number];
type FlowGraph = Pick<ExperimentFlowGraph, "nodes" | "edges">;

const NODE_MINUTES: Record<FlowNode["type"], number> = {
  instruction: 0.5,
  question: 0.5,
  measurement: 1.5,
  analysis: 0.5,
  branch: 0,
};

function orderReachableNodes(graph: FlowGraph): FlowNode[] {
  if (graph.nodes.length === 0) return [];

  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));
  const targetsBySource = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const targets = targetsBySource.get(edge.source) ?? [];
    targets.push(edge.target);
    targetsBySource.set(edge.source, targets);
  }

  const ordered: FlowNode[] = [];
  const visited = new Set<string>();
  let current: FlowNode | undefined = graph.nodes.find((node) => node.isStart) ?? graph.nodes[0];

  while (current && !visited.has(current.id)) {
    ordered.push(current);
    visited.add(current.id);
    const nextId: string | undefined = (targetsBySource.get(current.id) ?? []).find(
      (id) => !visited.has(id),
    );
    current = nextId ? nodesById.get(nextId) : undefined;
  }

  return ordered;
}

function isInlineCommand(node: FlowNode): boolean {
  return node.type === "measurement" && "command" in node.content;
}

export function deriveExperimentFlowMeta(graph: FlowGraph): ExperimentFlowMeta {
  const nodes = orderReachableNodes(graph);
  const duration = nodes.reduce(
    (total, node) => total + (isInlineCommand(node) ? 0 : NODE_MINUTES[node.type]),
    0,
  );

  return {
    requiresDevice: nodes.some((node) => node.type === "measurement"),
    questionsOnly:
      nodes.length > 0 &&
      nodes.every(
        (node) => node.type === "question" || node.type === "instruction" || node.type === "branch",
      ),
    nodeCount: nodes.length,
    durationMin: nodes.length === 0 ? 0 : Math.max(1, Math.round(duration)),
  };
}
