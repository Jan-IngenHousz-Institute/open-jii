import { describe, expect, it } from "vitest";
import { estimateFlowDuration } from "~/features/measurement-flow/utils/estimate-flow-duration";
import type { FlowNode } from "~/shared/measurements/flow-node";

const node = (type: FlowNode["type"]): FlowNode => ({
  id: type,
  type,
  name: type,
  content: {},
  isStart: false,
});

const commandNode = (): FlowNode =>
  ({
    id: "cmd",
    type: "measurement",
    name: "cmd",
    content: { command: { format: "string", content: "battery" } },
    isStart: false,
  }) as FlowNode;

describe("estimateFlowDuration", () => {
  it("returns 0 for an empty flow", () => {
    expect(estimateFlowDuration([])).toBe(0);
  });

  it("uses the configured heuristics", () => {
    const total = estimateFlowDuration([
      node("instruction"),
      node("question"),
      node("measurement"),
      node("analysis"),
    ]);
    // 0.5 + 0.5 + 1.5 + 0.5 = 3
    expect(total).toBe(3);
  });

  it("clamps to at least 1 minute when nodes exist", () => {
    expect(estimateFlowDuration([node("branch")])).toBe(1);
  });

  it("rounds to whole minutes", () => {
    const total = estimateFlowDuration([node("question"), node("question"), node("question")]);
    // 1.5 → rounded to 2 by Math.round
    expect(total).toBe(2);
  });

  it("treats an inline command as near-instant, not a 1.5 min scan", () => {
    // protocol measurement (1.5) + command measurement (0) = 1.5 → 2
    expect(estimateFlowDuration([node("measurement"), commandNode()])).toBe(2);
    // a lone command still floors at 1 minute
    expect(estimateFlowDuration([commandNode()])).toBe(1);
  });
});
