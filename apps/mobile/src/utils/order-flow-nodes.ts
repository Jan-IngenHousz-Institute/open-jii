import { FlowEdge, FlowNode } from "~/screens/measurement-flow-screen/types";

export function orderFlowNodes(nodes: FlowNode[], edges: FlowEdge[]): FlowNode[] {
  if (!nodes || nodes.length === 0) {
    return [];
  }

  const idToNode = new Map<string, FlowNode>();
  for (const node of nodes) {
    idToNode.set(node.id, node);
  }

  const fromTo = new Map<string, string[]>();
  for (const edge of edges ?? []) {
    if (!fromTo.has(edge.source)) {
      fromTo.set(edge.source, []);
    }
    fromTo.get(edge.source)?.push(edge.target);
  }

  const startNode = nodes.find((n) => n.isStart) ?? nodes[0];
  const visited = new Set<string>();
  const ordered: FlowNode[] = [];

  let current: FlowNode | undefined = startNode;
  while (current && !visited.has(current.id)) {
    ordered.push(current);
    visited.add(current.id);

    const nextIds = fromTo.get(current.id) ?? [];
    const nextId = nextIds.find((id) => !visited.has(id));
    current = nextId ? idToNode.get(nextId) : undefined;
  }

  // Append any unvisited nodes to keep a total ordering (fallback)
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      ordered.push(node);
    }
  }

  return ordered;
}
