import type { Node } from "@xyflow/react";
import { Position } from "@xyflow/react";

import type { LineageNodeModel } from "./build-device-lineage";

const NODE_WIDTH = 260;
const NODE_HEIGHT = 96;
const COLUMN_GAP = 120;
const ROW_GAP = 24;

/**
 * The lineage graph is a known pipeline, so columns are assigned rather than
 * inferred: dagre's ranker aligns every sink in one column, which would put
 * pipeline macros beside the experiments they precede.
 */
const COLUMN: Record<LineageNodeModel["kind"], number> = {
  protocol: 0,
  workbook: 0,
  device: 1,
  broker: 2,
  warehouse: 3,
  macro: 4,
  unattributed: 5,
  experiment: 5,
  "attribution-other": 0,
};

function columnFor(model: LineageNodeModel): number {
  if (model.kind === "attribution-other") {
    return model.attributionKind === "macro" ? COLUMN.macro : COLUMN.protocol;
  }
  return COLUMN[model.kind];
}

/** Deterministic column layout, each column vertically centred on the canvas. */
export function layoutLineage(nodes: Node[]): Node[] {
  // Matches the sibling flow layout: an empty graph has nothing to place, and
  // the column maths below would divide by an empty set.
  if (nodes.length === 0) {
    return nodes;
  }

  const columns = new Map<number, Node[]>();
  for (const node of nodes) {
    const column = columnFor((node.data as { model: LineageNodeModel }).model);
    const bucket = columns.get(column) ?? [];
    bucket.push(node);
    columns.set(column, bucket);
  }

  // Empty columns collapse, so a device with no macros keeps a tight graph.
  const used = [...columns.keys()].sort((a, b) => a - b);
  const xByColumn = new Map(
    used.map((column, index) => [column, index * (NODE_WIDTH + COLUMN_GAP)]),
  );
  const tallest = Math.max(...[...columns.values()].map((bucket) => bucket.length));
  const canvasHeight = tallest * (NODE_HEIGHT + ROW_GAP);

  return nodes.map((node) => {
    const column = columnFor((node.data as { model: LineageNodeModel }).model);
    const bucket = columns.get(column) ?? [];
    const row = bucket.indexOf(node);
    const columnHeight = bucket.length * (NODE_HEIGHT + ROW_GAP);
    return {
      ...node,
      position: {
        x: xByColumn.get(column) ?? 0,
        y: (canvasHeight - columnHeight) / 2 + row * (NODE_HEIGHT + ROW_GAP),
      },
      width: NODE_WIDTH,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    };
  });
}
