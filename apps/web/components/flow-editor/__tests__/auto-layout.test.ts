import type { Edge, Node } from "@xyflow/react";
import { Position } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import { autoLayout } from "../auto-layout";

const node = (id: string, type = "INSTRUCTION", data: Record<string, unknown> = {}): Node => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: { title: id, ...data },
});

const edge = (source: string, target: string): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
});

describe("autoLayout", () => {
  it("returns the input unchanged when there are no nodes", () => {
    expect(autoLayout([], [])).toEqual([]);
  });

  it("places a chain of nodes left-to-right with monotonically increasing x", () => {
    const nodes = [node("a"), node("b"), node("c")];
    const edges = [edge("a", "b"), edge("b", "c")];

    const out = autoLayout(nodes, edges);

    expect(out[0].position.x).toBeLessThan(out[1].position.x);
    expect(out[1].position.x).toBeLessThan(out[2].position.x);
    for (const n of out) {
      expect(n.sourcePosition).toBe(Position.Right);
      expect(n.targetPosition).toBe(Position.Left);
      expect(n.width).toBeGreaterThan(0);
      expect(n.height).toBeGreaterThan(0);
    }
  });

  it("gives branch nodes more height proportional to their path count", () => {
    const branchOne = node("b1", "BRANCH", {
      stepSpecification: { paths: [{ id: "p1" }] },
    });
    const branchThree = node("b3", "BRANCH", {
      stepSpecification: { paths: [{ id: "p1" }, { id: "p2" }, { id: "p3" }] },
    });

    const out = autoLayout([branchOne, branchThree], []);
    const [a, b] = out;

    expect(b.height).toBeGreaterThan(a.height ?? 0);
  });
});
