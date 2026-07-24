import type { z } from "zod";

import type {
  zExperimentFlowEdge,
  zExperimentFlowNode,
} from "../domains/experiment/experiment.schema";
import { isReferencedCommandPayload } from "../domains/workbook/command-source.schema";
import type { WorkbookCell } from "../domains/workbook/workbook-cells.schema";

/**
 * Deterministic, never-empty flow-node label for a dynamic command node. Uses
 * the author name when present, otherwise a label derived from the referenced
 * field. Never dereferences absent static content. Shared with the reverse
 * converter so the round-trip can tell a derived label from an authored name.
 */
export function dynamicCommandNodeLabel(opts: { name?: string; field: string }): string {
  const authored = opts.name?.trim();
  if (authored) return authored.slice(0, 64);
  const field = opts.field.trim();
  const derived = field ? `Dynamic command · ${field}` : "Dynamic command";
  return derived.slice(0, 64);
}

type FlowNode = z.infer<typeof zExperimentFlowNode>;
type FlowEdge = z.infer<typeof zExperimentFlowEdge>;
type Content = FlowNode["content"];

export interface DerivedFlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

// Length-prefixed, kind-tagged edge id: `<byteLen>:<value>` per segment so
// distinct tuples never coincide. Plain delimiter concatenation collided for
// valid ids (ordinary a->"b-c" and goto a/"b"->c both became "e-a-b-c"), which
// now trips the duplicate-edge-id check. The id is opaque (old ids stay valid).
function encodeEdgeId(kind: "seq" | "goto", segments: string[]): string {
  return [`e2`, kind, ...segments.map((s) => `${s.length}:${s}`)].join("|");
}

function makeEdge(source: string, target: string, label?: string, sourceHandle?: string): FlowEdge {
  const id =
    sourceHandle != null
      ? encodeEdgeId("goto", [source, sourceHandle, target])
      : encodeEdgeId("seq", [source, target]);
  return {
    id,
    source,
    target,
    label: label ?? null,
    sourceHandle: sourceHandle ?? null,
  };
}

function makeNode(
  id: string,
  type: FlowNode["type"],
  name: string,
  content: Content,
  isStart: boolean,
): FlowNode {
  return { id, type, name, content, isStart };
}

function cellToNode(cell: WorkbookCell, isStart: boolean): FlowNode | null {
  switch (cell.type) {
    case "protocol":
      return makeNode(
        cell.id,
        "measurement",
        cell.payload.name ?? `Protocol ${cell.payload.protocolId.slice(0, 8)}`,
        { protocolId: cell.payload.protocolId },
        isStart,
      );

    case "command": {
      // Command rides the existing measurement node so old apps drop it cleanly
      // (unknown content) rather than choking on a new node type. Branch on the
      // source variant before touching static `format`/`content`.
      if (isReferencedCommandPayload(cell.payload)) {
        const { sourceCellId, field } = cell.payload.ref;
        return makeNode(
          cell.id,
          "measurement",
          dynamicCommandNodeLabel({ name: cell.payload.name, field }),
          { command: { kind: "ref", ref: { sourceCellId, field } } },
          isStart,
        );
      }
      const source = cell.payload.name?.trim() ? cell.payload.name : cell.payload.content;
      const label = source
        .replace(/[\r\n]+/g, " ")
        .trim()
        .slice(0, 64);
      return makeNode(
        cell.id,
        "measurement",
        // Never empty: zFlowNode.name requires a min length of 1.
        label.length > 0 ? label : "Command",
        { command: { format: cell.payload.format, content: cell.payload.content } },
        isStart,
      );
    }

    case "macro":
      return makeNode(
        cell.id,
        "analysis",
        cell.payload.name ?? `Macro ${cell.payload.macroId.slice(0, 8)}`,
        { macroId: cell.payload.macroId },
        isStart,
      );

    case "question":
      // Cell `name` is the column-key label; data pipeline canonicalises it into a column key downstream.
      return makeNode(cell.id, "question", cell.name, cell.question, isStart);

    case "markdown":
      return makeNode(
        cell.id,
        "instruction",
        cell.content.slice(0, 64),
        { text: cell.content },
        isStart,
      );

    case "branch":
      // Carry the full path structure (conditions + goto) so a branch survives
      // cells -> flow -> cells losslessly. Goto is also emitted as an edge
      // (below) for the canvas; both representations agree.
      return makeNode(
        cell.id,
        "branch",
        "Branch",
        {
          paths: cell.paths.map((p) => ({
            id: p.id,
            label: p.label,
            color: p.color,
            conditions: p.conditions,
            ...(p.gotoCellId ? { gotoCellId: p.gotoCellId } : {}),
          })),
          defaultPathId: cell.defaultPathId,
        },
        isStart,
      );

    case "output":
      return null;

    default:
      return null;
  }
}

export function cellsToFlowGraph(cells: WorkbookCell[]): DerivedFlowGraph {
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];

  let previousId: string | null = null;
  let firstId: string | null = null;

  for (const cell of cells) {
    let node: FlowNode | null;
    try {
      node = cellToNode(cell, !firstId);
    } catch {
      continue;
    }
    if (!node) continue;

    nodes.push(node);
    firstId ??= node.id;

    if (previousId) {
      edges.push(makeEdge(previousId, node.id));
    }

    if (cell.type === "branch") {
      for (const path of cell.paths) {
        if (path.gotoCellId) {
          edges.push(makeEdge(cell.id, path.gotoCellId, path.label, path.id));
        }
      }
    }

    previousId = node.id;
  }

  const NODE_SPACING = 250;
  const Y_CENTER = 240;
  const totalWidth = (nodes.length - 1) * NODE_SPACING;
  const startX = -totalWidth / 2;
  for (let i = 0; i < nodes.length; i++) {
    nodes[i].position = { x: startX + i * NODE_SPACING, y: Y_CENTER };
  }

  return { nodes, edges };
}
