import type { FlowGraphDto } from "../../../core/models/flow.model";

// Shared flow-graph fixtures for the public-flow gate/validation specs.
const MACRO_UUID = "22222222-2222-2222-2222-222222222222";

const seq = (source: string, target: string) => ({
  id: `e-${source}-${target}`,
  source,
  target,
  sourceHandle: null,
});

const macroNode = (id: string, isStart = false) => ({
  id,
  type: "analysis" as const,
  name: "Macro",
  content: { macroId: MACRO_UUID },
  isStart,
});

const refNode = (id: string, sourceCellId: string, field = "toDevice", isStart = false) => ({
  id,
  type: "measurement" as const,
  name: "Dynamic command",
  content: { command: { kind: "ref" as const, ref: { sourceCellId, field } } },
  isStart,
});

const instructionNode = (id: string, isStart = false) => ({
  id,
  type: "instruction" as const,
  name: "Note",
  content: { text: "hi" },
  isStart,
});

const branchNode = (id: string, gotoCellId: string, isStart = false) => ({
  id,
  type: "branch" as const,
  name: "Branch",
  content: { paths: [{ id: "p1", label: "Go", color: "#000", gotoCellId }] },
  isStart,
});

const gotoEdge = (source: string, target: string) => ({
  id: `g-${source}-${target}`,
  source,
  target,
  sourceHandle: "p1",
});

/** A single ref node with a non-existent source: structurally invalid but still a ref graph. */
export const refFlowGraph = (): FlowGraphDto => ({
  nodes: [refNode("c1", "m1", "toDevice", true)],
  edges: [],
});

/** A structurally valid dynamic-ref graph: earlier eligible macro source -> ref command. */
export const validRefFlowGraph = (): FlowGraphDto => ({
  nodes: [macroNode("m1", true), refNode("c1", "m1")],
  edges: [seq("m1", "c1")],
});

/** Structurally invalid dynamic-ref graphs, keyed by the failure they exercise. */
export const invalidRefFlowGraphs: Record<string, () => FlowGraphDto> = {
  "missing source": () => ({
    nodes: [macroNode("m1", true), refNode("c1", "gone")],
    edges: [seq("m1", "c1")],
  }),
  "ineligible source": () => ({
    nodes: [instructionNode("i1", true), refNode("c1", "i1")],
    edges: [seq("i1", "c1")],
  }),
  "self reference": () => ({
    nodes: [refNode("c1", "c1", "toDevice", true)],
    edges: [],
  }),
  "later source": () => ({
    nodes: [refNode("c1", "m1", "toDevice", true), macroNode("m1")],
    edges: [seq("c1", "m1")],
  }),
  "blank field": () => ({
    nodes: [macroNode("m1", true), refNode("c1", "m1", "   ")],
    edges: [seq("m1", "c1")],
  }),
  "disconnected ref node": () => ({
    // c1 has no ordinary edge into it, so it is off every authored chain.
    nodes: [macroNode("m1", true), refNode("c1", "m1")],
    edges: [],
  }),
  "goto-only ref node": () => ({
    // c1 is reachable only through the branch goto, never the ordinary chain.
    nodes: [macroNode("s1", true), branchNode("b1", "c1"), refNode("c1", "s1")],
    edges: [seq("s1", "b1"), gotoEdge("b1", "c1")],
  }),
  "disconnected source": () => ({
    // c1 (the ref) is on the chain, but its source m1 sits off the chain.
    nodes: [refNode("c1", "m1", "toDevice", true), branchNode("b1", "m1"), macroNode("m1")],
    edges: [seq("c1", "b1"), gotoEdge("b1", "m1")],
  }),
  "duplicate node ids": () => ({
    nodes: [macroNode("m1", true), macroNode("m1"), refNode("c1", "m1")],
    edges: [seq("m1", "c1")],
  }),
  "duplicate edge ids": () => ({
    nodes: [macroNode("m1", true), refNode("c1", "m1")],
    edges: [
      { id: "e", source: "m1", target: "c1", sourceHandle: null },
      { id: "e", source: "c1", target: "m1", sourceHandle: null },
    ],
  }),
  "ordinary fork": () => ({
    nodes: [macroNode("m1", true), refNode("c1", "m1"), macroNode("m2")],
    edges: [seq("m1", "c1"), seq("m1", "m2")],
  }),
  "ordinary merge": () => ({
    nodes: [macroNode("m1", true), macroNode("m2"), refNode("c1", "m1")],
    edges: [seq("m1", "c1"), seq("m2", "c1")],
  }),
  "ordinary cycle": () => ({
    nodes: [macroNode("m1", true), refNode("c1", "m1")],
    edges: [seq("m1", "c1"), seq("c1", "m1")],
  }),
  "dangling ordinary edge": () => ({
    nodes: [macroNode("m1", true), refNode("c1", "m1")],
    edges: [seq("m1", "c1"), seq("c1", "ghost")],
  }),
  "type/content mismatch source": () => ({
    // Source claims analysis (macro) but carries instruction content.
    nodes: [
      { id: "m1", type: "analysis" as const, name: "Fake", content: { text: "x" }, isStart: true },
      refNode("c1", "m1"),
    ],
    edges: [seq("m1", "c1")],
  }),
};
