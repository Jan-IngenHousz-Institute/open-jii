import { describe, it, expect } from "vitest";
import type { z } from "zod";

import type {
  zExperimentFlowEdge,
  zExperimentFlowNode,
} from "../domains/experiment/experiment.schema";
import { analyzeOrdinaryChain, sequentialChainOrder } from "./flow-graph-topology";

type FlowNode = z.infer<typeof zExperimentFlowNode>;
type FlowEdge = z.infer<typeof zExperimentFlowEdge>;

const node = (id: string, isStart = false): FlowNode => ({
  id,
  type: "instruction",
  name: id,
  content: { text: id },
  isStart,
});
const seq = (source: string, target: string, id = `e-${source}-${target}`): FlowEdge => ({
  id,
  source,
  target,
  sourceHandle: null,
});
const goto = (source: string, target: string, id = `g-${source}-${target}`): FlowEdge => ({
  id,
  source,
  target,
  sourceHandle: "p1",
});

describe("analyzeOrdinaryChain", () => {
  it("reports no problems for a clean linear chain", () => {
    const nodes = [node("a", true), node("b"), node("c")];
    const { problems, chain } = analyzeOrdinaryChain(nodes, [seq("a", "b"), seq("b", "c")]);
    expect([...problems]).toEqual([]);
    expect(chain.map((n) => n.id)).toEqual(["a", "b", "c"]);
  });

  it("ignores goto (non-ordinary) edges for topology", () => {
    // A loop-back goto and a forward goto do not create fork/merge/cycle.
    const nodes = [node("a", true), node("b"), node("c")];
    const edges = [seq("a", "b"), seq("b", "c"), goto("b", "a"), goto("b", "c")];
    expect([...analyzeOrdinaryChain(nodes, edges).problems]).toEqual([]);
  });

  it("detects duplicate node ids and fails closed with an empty chain", () => {
    const nodes = [node("dup", true), node("dup")];
    const res = analyzeOrdinaryChain(nodes, []);
    expect(res.problems.has("duplicate-node-id")).toBe(true);
    expect(res.chain).toEqual([]);
  });

  it("detects duplicate edge ids", () => {
    const nodes = [node("a", true), node("b")];
    const res = analyzeOrdinaryChain(nodes, [seq("a", "b", "e"), seq("b", "a", "e")]);
    expect(res.problems.has("duplicate-edge-id")).toBe(true);
  });

  it("detects an ordinary fork (out-degree > 1)", () => {
    const nodes = [node("a", true), node("b"), node("c")];
    const res = analyzeOrdinaryChain(nodes, [seq("a", "b"), seq("a", "c")]);
    expect(res.problems.has("ordinary-fork")).toBe(true);
  });

  it("detects an ordinary merge (in-degree > 1)", () => {
    const nodes = [node("a", true), node("b"), node("c")];
    const res = analyzeOrdinaryChain(nodes, [seq("a", "c"), seq("b", "c")]);
    expect(res.problems.has("ordinary-merge")).toBe(true);
  });

  it("detects an ordinary cycle", () => {
    const nodes = [node("a", true), node("b")];
    const res = analyzeOrdinaryChain(nodes, [seq("a", "b"), seq("b", "a")]);
    expect(res.problems.has("ordinary-cycle")).toBe(true);
  });

  it("detects a dangling ordinary edge", () => {
    const nodes = [node("a", true)];
    const res = analyzeOrdinaryChain(nodes, [seq("a", "missing")]);
    expect(res.problems.has("dangling-ordinary-edge")).toBe(true);
  });

  it("detects an absent/ambiguous start", () => {
    const nodes = [node("a"), node("b")];
    expect(analyzeOrdinaryChain(nodes, [seq("a", "b")]).problems.has("no-unique-start")).toBe(true);
  });

  it("is invariant to edge array order", () => {
    const nodes = [node("a", true), node("b"), node("c")];
    const forward = [seq("a", "b"), seq("b", "c")];
    const reversed = [seq("b", "c"), seq("a", "b")];
    expect([...analyzeOrdinaryChain(nodes, forward).problems]).toEqual([
      ...analyzeOrdinaryChain(nodes, reversed).problems,
    ]);
    expect(sequentialChainOrder(nodes, forward).map((n) => n.id)).toEqual(
      sequentialChainOrder(nodes, reversed).map((n) => n.id),
    );
  });
});
