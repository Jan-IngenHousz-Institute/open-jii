import type {
  AnalysisContent,
  FlowNode,
  MeasurementContent,
  ResolvedMacro,
  ResolvedProtocol,
} from "~/shared/measurements/flow-node";

/** Node copies without `content.protocol.code` / `content.macro.code`. */
export function stripSnapshotCode(nodes: FlowNode[]): FlowNode[] {
  return nodes.map((node) => {
    const content = node.content as (MeasurementContent & AnalysisContent) | undefined;

    if (node.type === "measurement" && content?.protocol) {
      // Rest, not delete: the key must be absent in JSON, not null.
      const { code: _code, ...protocol } = content.protocol;
      return { ...node, content: { ...content, protocol } };
    }

    if (node.type === "analysis" && content?.macro) {
      const { code: _code, ...macro } = content.macro;
      return { ...node, content: { ...content, macro } };
    }

    return node;
  });
}

/**
 * True when a protocol/macro snapshot object exists but has no `code`, i.e. it
 * was stripped by partialize. Resolved-empty code (`[]` / `""`) and nodes with
 * no snapshot object at all are not unresolved: re-hydrating cannot fix them.
 */
export function hasUnresolvedSnapshotCode(nodes: FlowNode[]): boolean {
  return nodes.some((node) => {
    const content = node.content as (MeasurementContent & AnalysisContent) | undefined;

    if (node.type === "measurement") {
      return isUnresolved(content?.protocolId, content?.protocol);
    }
    if (node.type === "analysis") {
      return isUnresolved(content?.macroId, content?.macro);
    }
    return false;
  });
}

function isUnresolved(
  id: string | undefined,
  snapshot: ResolvedProtocol | ResolvedMacro | undefined,
): boolean {
  return !!id && !!snapshot && snapshot.code === undefined;
}
