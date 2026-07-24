import { describe, it, expect } from "vitest";
import type { z } from "zod";

import type {
  zExperimentFlowEdge,
  zExperimentFlowNode,
} from "../domains/experiment/experiment.schema";
import type { WorkbookCell } from "../domains/workbook/workbook-cells.schema";
import {
  flowGraphHasDynamicCommandRef,
  hasDynamicCommandRef,
  validateDynamicCommandFlowGraph,
  validateDynamicCommandReferences,
} from "./dynamic-command-refs";

type FlowNode = z.infer<typeof zExperimentFlowNode>;
type FlowEdge = z.infer<typeof zExperimentFlowEdge>;

const uuid = "11111111-1111-1111-1111-111111111111";

function macro(id: string): WorkbookCell {
  return { id, type: "macro", isCollapsed: false, payload: { macroId: uuid, language: "python" } };
}
function markdown(id: string): WorkbookCell {
  return { id, type: "markdown", isCollapsed: false, content: "note" };
}
function refCommand(id: string, sourceCellId: string, field = "toDevice"): WorkbookCell {
  return {
    id,
    type: "command",
    isCollapsed: false,
    payload: { kind: "ref", ref: { sourceCellId, field } },
  };
}
function staticCommand(id: string): WorkbookCell {
  return {
    id,
    type: "command",
    isCollapsed: false,
    payload: { format: "string", content: "battery" },
  };
}
function output(id: string, producedBy: string): WorkbookCell {
  return { id, type: "output", isCollapsed: false, producedBy };
}

describe("hasDynamicCommandRef", () => {
  it("is false for static-only workbooks", () => {
    expect(hasDynamicCommandRef([macro("m1"), staticCommand("c1")])).toBe(false);
  });
  it("is true when any command is a ref", () => {
    expect(hasDynamicCommandRef([macro("m1"), refCommand("c1", "m1")])).toBe(true);
  });
});

describe("validateDynamicCommandReferences", () => {
  it("passes a valid earlier-source ref", () => {
    expect(validateDynamicCommandReferences([macro("m1"), refCommand("c1", "m1")])).toEqual([]);
  });

  it("ignores static commands entirely", () => {
    expect(validateDynamicCommandReferences([macro("m1"), staticCommand("c1")])).toEqual([]);
  });

  it("flags a missing source id", () => {
    const issues = validateDynamicCommandReferences([refCommand("c1", "")]);
    expect(issues.map((i) => i.code)).toContain("DYNAMIC_COMMAND_SOURCE_MISSING");
  });

  it("flags a deleted source cell", () => {
    const issues = validateDynamicCommandReferences([refCommand("c1", "gone")]);
    expect(issues.map((i) => i.code)).toContain("DYNAMIC_COMMAND_SOURCE_MISSING");
  });

  it("flags an ineligible source (markdown)", () => {
    const issues = validateDynamicCommandReferences([markdown("md1"), refCommand("c1", "md1")]);
    expect(issues.map((i) => i.code)).toContain("DYNAMIC_COMMAND_SOURCE_INELIGIBLE");
  });

  it("flags a self reference", () => {
    const issues = validateDynamicCommandReferences([refCommand("c1", "c1")]);
    expect(issues.map((i) => i.code)).toContain("DYNAMIC_COMMAND_SOURCE_NOT_EARLIER");
  });

  it("flags a source that appears later in document order", () => {
    const issues = validateDynamicCommandReferences([refCommand("c1", "m1"), macro("m1")]);
    expect(issues.map((i) => i.code)).toContain("DYNAMIC_COMMAND_SOURCE_NOT_EARLIER");
  });

  it("flags a blank field independently of the source", () => {
    const issues = validateDynamicCommandReferences([macro("m1"), refCommand("c1", "m1", "  ")]);
    expect(issues.map((i) => i.code)).toEqual(["DYNAMIC_COMMAND_FIELD_EMPTY"]);
  });

  it("excludes output cells from the author-order relation", () => {
    // Output between the source and command must not disturb the earlier check.
    const cells = [macro("m1"), output("o1", "m1"), refCommand("c1", "m1")];
    expect(validateDynamicCommandReferences(cells)).toEqual([]);
  });

  it("carries structured context (command/source/field/index)", () => {
    const issues = validateDynamicCommandReferences([macro("m1"), refCommand("c1", "gone", "f")]);
    expect(issues[0]).toMatchObject({
      code: "DYNAMIC_COMMAND_SOURCE_MISSING",
      commandCellId: "c1",
      sourceCellId: "gone",
      field: "f",
      index: 1,
    });
  });
});

describe("flowGraphHasDynamicCommandRef", () => {
  it("is false for a static/protocol flow graph", () => {
    const graph = {
      nodes: [
        { id: "n1", content: { protocolId: uuid } },
        { id: "n2", content: { command: { format: "string", content: "battery" } } },
      ],
    };
    expect(flowGraphHasDynamicCommandRef(graph)).toBe(false);
  });

  it("is true when a node carries a ref command", () => {
    const graph = {
      nodes: [
        {
          id: "n1",
          content: { command: { kind: "ref", ref: { sourceCellId: "m1", field: "f" } } },
        },
      ],
    };
    expect(flowGraphHasDynamicCommandRef(graph)).toBe(true);
  });

  it("is false for null/empty graphs", () => {
    expect(flowGraphHasDynamicCommandRef(null)).toBe(false);
    expect(flowGraphHasDynamicCommandRef({ nodes: [] })).toBe(false);
  });

  it("is total over unknown and never throws for malformed shapes", () => {
    // Any of these would throw under a naive `graph.nodes.some(...)`.
    const malformed: unknown[] = [
      undefined,
      null,
      "not-an-object",
      42,
      {},
      { nodes: null },
      { nodes: "not-an-array" },
      { nodes: {} },
      { nodes: [null] },
      { nodes: ["string-node"] },
      { nodes: [42] },
      { nodes: [{ id: "n1" }] }, // no content
      { nodes: [{ id: "n1", content: null }] },
      { nodes: [{ id: "n1", content: "str" }] },
      { nodes: [{ id: "n1", content: { command: null } }] },
      { nodes: [{ id: "n1", content: { command: "str" } }] },
    ];
    for (const graph of malformed) {
      expect(() => flowGraphHasDynamicCommandRef(graph)).not.toThrow();
      expect(flowGraphHasDynamicCommandRef(graph)).toBe(false);
    }
  });

  it("detects a ref-like carrier even with a malformed/kindless ref (safely)", () => {
    expect(
      flowGraphHasDynamicCommandRef({ nodes: [{ content: { command: { ref: null } } }] }),
    ).toBe(true);
    expect(
      flowGraphHasDynamicCommandRef({ nodes: [{ content: { command: { kind: "ref" } } }] }),
    ).toBe(true);
  });
});

describe("validateDynamicCommandFlowGraph", () => {
  const macroNode = (id: string, isStart = false): FlowNode => ({
    id,
    type: "analysis",
    name: "Macro",
    content: { macroId: uuid },
    isStart,
  });
  const refNode = (
    id: string,
    sourceCellId: string,
    field = "toDevice",
    isStart = false,
  ): FlowNode => ({
    id,
    type: "measurement",
    name: "Dyn",
    content: { command: { kind: "ref", ref: { sourceCellId, field } } },
    isStart,
  });
  const instructionNode = (id: string, isStart = false): FlowNode => ({
    id,
    type: "instruction",
    name: "Note",
    content: { text: "hi" },
    isStart,
  });
  const seq = (source: string, target: string): FlowEdge => ({
    id: `e-${source}-${target}`,
    source,
    target,
    sourceHandle: null,
  });

  it("passes a valid earlier eligible source", () => {
    const nodes = [macroNode("m1", true), refNode("c1", "m1")];
    expect(validateDynamicCommandFlowGraph(nodes, [seq("m1", "c1")])).toEqual([]);
  });

  it("flags a missing source", () => {
    const nodes = [macroNode("m1", true), refNode("c1", "gone")];
    const codes = validateDynamicCommandFlowGraph(nodes, [seq("m1", "c1")]).map((i) => i.code);
    expect(codes).toContain("DYNAMIC_COMMAND_SOURCE_MISSING");
  });

  it("flags an ineligible source (instruction)", () => {
    const nodes = [instructionNode("i1", true), refNode("c1", "i1")];
    const codes = validateDynamicCommandFlowGraph(nodes, [seq("i1", "c1")]).map((i) => i.code);
    expect(codes).toContain("DYNAMIC_COMMAND_SOURCE_INELIGIBLE");
  });

  it("flags a self reference", () => {
    const nodes = [refNode("c1", "c1", "toDevice", true)];
    const codes = validateDynamicCommandFlowGraph(nodes, []).map((i) => i.code);
    expect(codes).toContain("DYNAMIC_COMMAND_SOURCE_NOT_EARLIER");
  });

  it("flags a later source in authored (ordinary-edge) order", () => {
    // Command first, source after: ordinary traversal c1 -> m1 makes m1 later.
    const nodes = [refNode("c1", "m1", "toDevice", true), macroNode("m1")];
    const codes = validateDynamicCommandFlowGraph(nodes, [seq("c1", "m1")]).map((i) => i.code);
    expect(codes).toContain("DYNAMIC_COMMAND_SOURCE_NOT_EARLIER");
  });

  it("flags a blank field", () => {
    const nodes = [macroNode("m1", true), refNode("c1", "m1", "   ")];
    const codes = validateDynamicCommandFlowGraph(nodes, [seq("m1", "c1")]).map((i) => i.code);
    expect(codes).toContain("DYNAMIC_COMMAND_FIELD_EMPTY");
  });

  const branchNode = (id: string, gotoCellId: string, isStart = false): FlowNode => ({
    id,
    type: "branch",
    name: "Branch",
    content: { paths: [{ id: "p1", label: "Go", color: "#000", gotoCellId }] },
    isStart,
  });
  const goto = (source: string, target: string): FlowEdge => ({
    id: `g-${source}-${target}`,
    source,
    target,
    sourceHandle: "p1",
  });

  it("fails closed for a disconnected ref node (not on any authored chain)", () => {
    // m1 is the (only) chain node; c1 has no ordinary edge into it.
    const nodes = [macroNode("m1", true), refNode("c1", "m1")];
    const codes = validateDynamicCommandFlowGraph(nodes, []).map((i) => i.code);
    expect(codes).toContain("DYNAMIC_COMMAND_NODE_UNREACHABLE");
  });

  it("fails closed for a goto-only ref node (reachable only via a goto edge)", () => {
    // start -> b1 (ordinary); b1 --goto--> c1. c1 is never on the ordinary chain.
    const nodes = [macroNode("s1", true), branchNode("b1", "c1"), refNode("c1", "s1")];
    const codes = validateDynamicCommandFlowGraph(nodes, [seq("s1", "b1"), goto("b1", "c1")]).map(
      (i) => i.code,
    );
    expect(codes).toContain("DYNAMIC_COMMAND_NODE_UNREACHABLE");
  });

  it("flags a source that exists but sits off the authored chain (goto-only source)", () => {
    // c1 is the chain start; m1 exists but is only reachable via b1's goto.
    const nodes = [refNode("c1", "m1", "toDevice", true), branchNode("b1", "m1"), macroNode("m1")];
    const codes = validateDynamicCommandFlowGraph(nodes, [seq("c1", "b1"), goto("b1", "m1")]).map(
      (i) => i.code,
    );
    expect(codes).toContain("DYNAMIC_COMMAND_SOURCE_NOT_EARLIER");
  });

  it("passes a valid complete chain (source and command both on the ordinary chain)", () => {
    const nodes = [macroNode("m1", true), refNode("c1", "m1")];
    expect(validateDynamicCommandFlowGraph(nodes, [seq("m1", "c1")])).toEqual([]);
  });

  it("flags a source whose content does not match its declared type", () => {
    // Node claims to be a macro (analysis) but carries instruction content.
    const badSource: FlowNode = {
      id: "m1",
      type: "analysis",
      name: "Fake macro",
      content: { text: "not a macro" },
      isStart: true,
    };
    const nodes = [badSource, refNode("c1", "m1")];
    const codes = validateDynamicCommandFlowGraph(nodes, [seq("m1", "c1")]).map((i) => i.code);
    expect(codes).toContain("DYNAMIC_COMMAND_SOURCE_INELIGIBLE");
  });

  describe("graph integrity (authored order unknowable => GRAPH_AMBIGUOUS)", () => {
    const codesFor = (nodes: FlowNode[], edges: FlowEdge[]) =>
      validateDynamicCommandFlowGraph(nodes, edges).map((i) => i.code);

    it("fails closed on duplicate node ids (source-first ordering)", () => {
      const nodes = [macroNode("m1", true), macroNode("m1"), refNode("c1", "m1")];
      expect(codesFor(nodes, [seq("m1", "c1")])).toContain("DYNAMIC_COMMAND_GRAPH_AMBIGUOUS");
    });

    it("fails closed on duplicate node ids (ref-first ordering)", () => {
      const nodes = [refNode("c1", "m1", "toDevice", true), macroNode("m1"), macroNode("m1")];
      expect(codesFor(nodes, [seq("c1", "m1")])).toContain("DYNAMIC_COMMAND_GRAPH_AMBIGUOUS");
    });

    it("fails closed on duplicate ref (command) ids", () => {
      const nodes = [macroNode("m1", true), refNode("c1", "m1"), refNode("c1", "m1")];
      expect(codesFor(nodes, [seq("m1", "c1")])).toContain("DYNAMIC_COMMAND_GRAPH_AMBIGUOUS");
    });

    it("fails closed on duplicate edge ids", () => {
      const nodes = [macroNode("m1", true), refNode("c1", "m1")];
      const dup: FlowEdge[] = [
        { id: "e", source: "m1", target: "c1", sourceHandle: null },
        { id: "e", source: "c1", target: "m1", sourceHandle: null },
      ];
      expect(codesFor(nodes, dup)).toContain("DYNAMIC_COMMAND_GRAPH_AMBIGUOUS");
    });

    it("fails closed on an ordinary fork", () => {
      const nodes = [macroNode("m1", true), refNode("c1", "m1"), macroNode("m2")];
      expect(codesFor(nodes, [seq("m1", "c1"), seq("m1", "m2")])).toContain(
        "DYNAMIC_COMMAND_GRAPH_AMBIGUOUS",
      );
    });

    it("fails closed on an ordinary merge", () => {
      const nodes = [macroNode("m1", true), macroNode("m2"), refNode("c1", "m1")];
      expect(codesFor(nodes, [seq("m1", "c1"), seq("m2", "c1")])).toContain(
        "DYNAMIC_COMMAND_GRAPH_AMBIGUOUS",
      );
    });

    it("fails closed on an ordinary cycle", () => {
      const nodes = [macroNode("m1", true), refNode("c1", "m1")];
      expect(codesFor(nodes, [seq("m1", "c1"), seq("c1", "m1")])).toContain(
        "DYNAMIC_COMMAND_GRAPH_AMBIGUOUS",
      );
    });

    it("fails closed on a dangling ordinary edge", () => {
      const nodes = [macroNode("m1", true), refNode("c1", "m1")];
      expect(codesFor(nodes, [seq("m1", "c1"), seq("c1", "ghost")])).toContain(
        "DYNAMIC_COMMAND_GRAPH_AMBIGUOUS",
      );
    });

    it("is invariant to edge array order", () => {
      const nodes = [macroNode("m1", true), refNode("c1", "m1")];
      const forward = [seq("m1", "c1")];
      expect(validateDynamicCommandFlowGraph(nodes, forward)).toEqual(
        validateDynamicCommandFlowGraph(nodes, [...forward].reverse()),
      );
    });
  });

  describe("invalid ref carriers => INVALID_CARRIER", () => {
    const codesFor = (nodes: FlowNode[], edges: FlowEdge[]) =>
      validateDynamicCommandFlowGraph(nodes, edges).map((i) => i.code);
    // A ref carrier on a node whose type is `type`, with `command` content.
    const carrierNode = (id: string, type: FlowNode["type"], command: unknown): FlowNode =>
      ({ id, type, name: id, content: { command }, isStart: false }) as FlowNode;
    const validRef = { kind: "ref", ref: { sourceCellId: "m1", field: "toDevice" } };

    it("flags a ref carrier on an instruction node", () => {
      const nodes = [macroNode("m1", true), carrierNode("c1", "instruction", validRef)];
      expect(codesFor(nodes, [seq("m1", "c1")])).toContain("DYNAMIC_COMMAND_INVALID_CARRIER");
    });

    it("flags a ref carrier on an analysis node", () => {
      const nodes = [macroNode("m1", true), carrierNode("c1", "analysis", validRef)];
      expect(codesFor(nodes, [seq("m1", "c1")])).toContain("DYNAMIC_COMMAND_INVALID_CARRIER");
    });

    it("flags a ref carrier on a branch node", () => {
      const nodes = [macroNode("m1", true), carrierNode("c1", "branch", validRef)];
      expect(codesFor(nodes, [seq("m1", "c1")])).toContain("DYNAMIC_COMMAND_INVALID_CARRIER");
    });

    it("flags a measurement ref carrier with mixed static + ref keys", () => {
      const mixed = {
        kind: "ref",
        ref: { sourceCellId: "m1", field: "toDevice" },
        format: "string",
        content: "x",
      };
      const nodes = [macroNode("m1", true), carrierNode("c1", "measurement", mixed)];
      expect(codesFor(nodes, [seq("m1", "c1")])).toContain("DYNAMIC_COMMAND_INVALID_CARRIER");
    });

    it("flags a measurement ref carrier with a malformed ref object", () => {
      const malformed = { kind: "ref", ref: { field: "toDevice" } }; // no sourceCellId
      const nodes = [macroNode("m1", true), carrierNode("c1", "measurement", malformed)];
      expect(codesFor(nodes, [seq("m1", "c1")])).toContain("DYNAMIC_COMMAND_INVALID_CARRIER");
    });

    it("flags a ref-like carrier that omits the kind discriminator", () => {
      const noKind = { ref: { sourceCellId: "m1", field: "toDevice" } };
      const nodes = [macroNode("m1", true), carrierNode("c1", "measurement", noKind)];
      expect(codesFor(nodes, [seq("m1", "c1")])).toContain("DYNAMIC_COMMAND_INVALID_CARRIER");
    });

    it("does NOT flag a well-formed measurement ref carrier", () => {
      const nodes = [macroNode("m1", true), carrierNode("c1", "measurement", validRef)];
      expect(codesFor(nodes, [seq("m1", "c1")])).not.toContain("DYNAMIC_COMMAND_INVALID_CARRIER");
    });
  });
});
