import { describe, expect, it } from "vitest";
import { hydrateFlowNodes } from "~/features/measurement-flow/utils/hydrate-flow-nodes";
import type { FlowNode } from "~/shared/measurements/flow-node";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import type { EntitySnapshots } from "@repo/api/domains/workbook/workbook-version.schema";

import { hasUnresolvedSnapshotCode, stripSnapshotCode } from "./flow-snapshots";

const cells: WorkbookCell[] = [
  {
    id: "m1",
    type: "protocol",
    isCollapsed: false,
    payload: { protocolId: "p1", version: 1, name: "My Protocol" },
  },
  {
    id: "a1",
    type: "macro",
    isCollapsed: false,
    payload: { macroId: "mac1", language: "python", name: "My Macro" },
  },
];

const snapshots: EntitySnapshots = {
  protocols: { p1: { code: [{ pulses: [1] }], family: "multispeq" } },
  macros: { mac1: { code: "print(1)" } },
};

const measurement: FlowNode = {
  id: "m1",
  name: "spad",
  type: "measurement",
  isStart: false,
  content: {
    params: { averages: 3 },
    protocolId: "p1",
    protocol: { code: [{ pulses: [1] }], name: "My Protocol", family: "multispeq" },
  },
};

const analysis: FlowNode = {
  id: "a1",
  name: "spad_macro",
  type: "analysis",
  isStart: false,
  content: {
    params: { threshold: 40 },
    macroId: "mac1",
    macro: {
      id: "mac1",
      name: "My Macro",
      filename: "mac1.py",
      language: "python",
      code: "print(1)",
    },
  },
};

const question: FlowNode = {
  id: "q1",
  name: "plant_id",
  type: "question",
  isStart: true,
  content: { kind: "text", text: "Plant ID?", required: true },
};

const instruction: FlowNode = {
  id: "i1",
  name: "clip",
  type: "instruction",
  isStart: false,
  content: { text: "Clip the leaf." },
};

const branch: FlowNode = {
  id: "b1",
  name: "n_branch",
  type: "branch",
  isStart: false,
  content: { conditions: [{ label: "High N" }] },
};

// A measurement node carrying an inline command instead of a protocol ref.
const inlineCommand: FlowNode = {
  id: "c1",
  name: "raw_command",
  type: "measurement",
  isStart: false,
  content: { command: { format: "string", content: "1+1" } },
};

describe("stripSnapshotCode", () => {
  it("removes protocol code and keeps every other protocol field", () => {
    const [stripped] = stripSnapshotCode([measurement]);

    expect(stripped.content.protocol).toStrictEqual({ name: "My Protocol", family: "multispeq" });
    expect("code" in stripped.content.protocol).toBe(false);
    expect(stripped.content.params).toEqual({ averages: 3 });
    expect(stripped.content.protocolId).toBe("p1");
  });

  it("removes macro code and keeps every other macro field", () => {
    const [stripped] = stripSnapshotCode([analysis]);

    expect(stripped.content.macro).toStrictEqual({
      id: "mac1",
      name: "My Macro",
      filename: "mac1.py",
      language: "python",
    });
    expect("code" in stripped.content.macro).toBe(false);
    expect(stripped.content.macroId).toBe("mac1");
  });

  it("does not mutate the input nodes", () => {
    stripSnapshotCode([measurement, analysis]);

    expect(measurement.content.protocol.code).toEqual([{ pulses: [1] }]);
    expect(analysis.content.macro.code).toBe("print(1)");
  });

  it("is idempotent", () => {
    const once = stripSnapshotCode([measurement, analysis]);
    const twice = stripSnapshotCode(once);

    expect(twice).toEqual(once);
  });

  it.each([
    ["question", question],
    ["instruction", instruction],
    ["branch", branch],
    ["inline-command measurement", inlineCommand],
  ])("returns a %s node by reference", (_label, node) => {
    expect(stripSnapshotCode([node])[0]).toBe(node);
  });

  it("survives a JSON round trip with the code key absent, not null", () => {
    const envelope = JSON.stringify(stripSnapshotCode([measurement, analysis]));

    expect(envelope).not.toContain("pulses");
    expect(envelope).not.toContain("print(1)");
    expect(envelope).not.toContain("null");
  });
});

describe("hasUnresolvedSnapshotCode", () => {
  it("is true for stripped protocol and macro nodes", () => {
    expect(hasUnresolvedSnapshotCode(stripSnapshotCode([measurement]))).toBe(true);
    expect(hasUnresolvedSnapshotCode(stripSnapshotCode([analysis]))).toBe(true);
  });

  it("is false once hydrateFlowNodes has re-attached the code", () => {
    const stripped = stripSnapshotCode([measurement, analysis, question]);

    expect(hasUnresolvedSnapshotCode(hydrateFlowNodes(stripped, cells, snapshots))).toBe(false);
  });

  it("is false for resolved-empty code the version could not supply", () => {
    const empty = hydrateFlowNodes([measurement, analysis], [], {
      protocols: {},
      macros: {},
    });

    expect(empty[0].content.protocol.code).toEqual([]);
    expect(empty[1].content.macro.code).toBe("");
    expect(hasUnresolvedSnapshotCode(empty)).toBe(false);
  });

  it("is false when the node carries no protocol/macro object at all", () => {
    const bare: FlowNode[] = [
      { ...measurement, content: { params: {}, protocolId: "p1" } },
      { ...analysis, content: { params: {}, macroId: "mac1" } },
    ];

    expect(hasUnresolvedSnapshotCode(bare)).toBe(false);
  });

  it("is false for an empty flow and for nodes that hold no snapshots", () => {
    expect(hasUnresolvedSnapshotCode([])).toBe(false);
    expect(hasUnresolvedSnapshotCode([question, instruction, branch, inlineCommand])).toBe(false);
  });

  it("is true when only one node of a mixed flow is unresolved", () => {
    const [strippedMeasurement] = stripSnapshotCode([measurement]);

    expect(hasUnresolvedSnapshotCode([question, analysis, strippedMeasurement])).toBe(true);
  });
});
