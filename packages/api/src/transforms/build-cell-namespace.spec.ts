import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

import type { WorkbookCell } from "../domains/workbook/workbook-cells.schema";
import {
  buildCellNamespace,
  isOutputDataNormalizationError,
  OutputDataNormalizationError,
  resolveOutputData,
} from "./build-cell-namespace";
import { resolveConditionValue } from "./evaluate-branch";
import type { MacroInputErrorCode, NormalizeMacroInputResult } from "./normalize-macro-input";

interface NormalizationFixture {
  cases: {
    name: string;
    input: unknown;
    expected: NormalizeMacroInputResult;
  }[];
}

const normalizationFixtures = JSON.parse(
  readFileSync(resolve(__dirname, "../../fixtures/macro-input-normalization.json"), "utf8"),
) as NormalizationFixture;

const uuid = "11111111-1111-1111-1111-111111111111";

function protocol(id: string, name?: string): WorkbookCell {
  return {
    id,
    type: "protocol",
    isCollapsed: false,
    payload: { protocolId: uuid, version: 1, name },
  };
}
function macro(id: string, name?: string): WorkbookCell {
  return {
    id,
    type: "macro",
    isCollapsed: false,
    payload: { macroId: uuid, language: "javascript", name },
  };
}
function command(id: string, name?: string): WorkbookCell {
  return {
    id,
    type: "command",
    isCollapsed: false,
    payload: { format: "string", content: "status", name },
  };
}
function output(producedBy: string, data: unknown): WorkbookCell {
  return { id: `out-${producedBy}`, type: "output", isCollapsed: false, producedBy, data };
}
function question(id: string, name: string, answer?: string): WorkbookCell {
  return {
    id,
    type: "question",
    isCollapsed: false,
    name,
    isAnswered: answer != null,
    question: { kind: "open_ended", text: "?", required: false },
    ...(answer != null ? { answer } : {}),
  };
}

describe("buildCellNamespace", () => {
  it("keys producer outputs by id and by canonical name", () => {
    const cells = [protocol("p1", "Baseline"), output("p1", { value: 0.8 })];
    const ns = buildCellNamespace(cells);
    expect(ns.byId.p1).toEqual({ value: 0.8 });
    expect(ns.ctx.baseline).toEqual({ value: 0.8 });
    expect(ns.names.baseline).toBe("p1");
  });

  it("exposes an answered question as { answer }", () => {
    const cells = [question("q1", "Soil moisture", "wet")];
    const ns = buildCellNamespace(cells);
    expect(ns.byId.q1).toEqual({ answer: "wet" });
    expect(ns.ctx.soil_moisture).toEqual({ answer: "wet" });
  });

  it("omits unanswered questions and producers without output", () => {
    const cells = [question("q1", "Unanswered"), protocol("p1", "NoRun")];
    const ns = buildCellNamespace(cells);
    expect(ns.byId).toEqual({});
    expect(ns.ctx).toEqual({});
  });

  it("includes unnamed producers in byId but not ctx", () => {
    const cells = [protocol("p1"), output("p1", { v: 1 })];
    const ns = buildCellNamespace(cells);
    expect(ns.byId.p1).toEqual({ v: 1 });
    expect(ns.ctx).toEqual({});
  });

  it("keeps a root array output unchanged", () => {
    const data = [{ value: 1 }, { value: 2 }];
    const cells = [protocol("p1", "Scan"), output("p1", data)];
    const ns = buildCellNamespace(cells);
    expect(ns.ctx.scan).toBe(data);
  });

  it("only sees cells strictly before beforeIndex (upstream-only)", () => {
    const cells = [
      protocol("p1", "Up"),
      output("p1", { value: 1 }),
      macro("m1", "Self"),
      output("m1", { value: 2 }),
      protocol("p2", "Down"),
      output("p2", { value: 3 }),
    ];
    // From the macro's position (index 2), only p1's output is visible.
    const ns = buildCellNamespace(cells, 2);
    expect(ns.ctx.up).toEqual({ value: 1 });
    expect(ns.ctx.self).toBeUndefined();
    expect(ns.ctx.down).toBeUndefined();
  });

  it("reads an upstream output many cells back", () => {
    const cells = [
      protocol("p1", "Baseline"),
      output("p1", { value: 0.8 }),
      { id: "md1", type: "markdown", isCollapsed: false, content: "note" } as WorkbookCell,
      question("q1", "Note", "ok"),
      protocol("p2", "Stress"),
      output("p2", { value: 0.4 }),
      macro("m1", "Compare"),
    ];
    const ns = buildCellNamespace(cells, cells.length - 1);
    expect(ns.ctx.baseline).toEqual({ value: 0.8 });
    expect(ns.ctx.stress).toEqual({ value: 0.4 });
    expect(ns.ctx.note).toEqual({ answer: "ok" });
  });
});

describe("resolveOutputData", () => {
  it("returns undefined when no output exists", () => {
    expect(resolveOutputData([protocol("p1")], "p1")).toBeUndefined();
  });

  it.each(normalizationFixtures.cases)(
    "uses the shared normalization contract for $name",
    ({ input, expected }) => {
      const cells = [protocol("p1"), output("p1", input)];
      if (expected.ok) {
        expect(resolveOutputData(cells, "p1")).toEqual(expected.value);
        expect(buildCellNamespace(cells).byId.p1).toEqual(expected.value);
      } else {
        expect(() => resolveOutputData(cells, "p1")).toThrowError(
          expect.objectContaining({
            name: "OutputDataNormalizationError",
            code: expected.error,
            source: expected.source,
          }),
        );
        expect(() => buildCellNamespace(cells)).toThrowError(OutputDataNormalizationError);
      }
    },
  );

  it("does not mutate or replace the raw stored output", () => {
    const raw = { sample: [{ value: 1 }, { value: 2 }] };
    const cells = [protocol("p1", "Scan"), output("p1", raw)];

    expect(resolveOutputData(cells, "p1")).toEqual({ value: 1 });
    expect((cells[1] as Extract<WorkbookCell, { type: "output" }>).data).toBe(raw);
    expect(raw).toEqual({ sample: [{ value: 1 }, { value: 2 }] });
  });

  it("normalizes reserved top-level sample outputs from commands and prior macros", () => {
    const cells = [
      command("c1", "Status"),
      output("c1", { sample: [{ value: "ready" }] }),
      macro("m1", "Prior"),
      output("m1", { sample: { value: "complete" } }),
    ];

    expect(buildCellNamespace(cells).ctx).toMatchObject({
      status: { value: "ready" },
      prior: { value: "complete" },
    });
  });

  it("keeps nested sample fields literal", () => {
    const nested = { reading: { sample: [{ value: 2 }] } };
    const cells = [protocol("p1", "Scan"), output("p1", nested)];

    expect(resolveOutputData(cells, "p1")).toBe(nested);
    expect(buildCellNamespace(cells).ctx.scan).toBe(nested);
  });
});

describe("isOutputDataNormalizationError", () => {
  it("recognizes the normalization error regardless of its code", () => {
    const futureError = new OutputDataNormalizationError(
      "future-code" as MacroInputErrorCode,
      "sample-envelope",
    );

    expect(isOutputDataNormalizationError(futureError)).toBe(true);
  });

  it("rejects unrelated errors that happen to have a code", () => {
    const unrelatedError = Object.assign(new Error("unrelated"), { code: "future-code" });

    expect(isOutputDataNormalizationError(unrelatedError)).toBe(false);
  });
});

describe("parity with resolveConditionValue", () => {
  // The namespace must project the same field value a branch condition reads,
  // so branch routing and macro ctx can never disagree.
  const cases: { data: unknown; field: string }[] = [
    { data: { "Fv/Fm": 0.7 }, field: "Fv/Fm" },
    { data: { label: "green" }, field: "label" },
    { data: [{ value: 42 }], field: "value" },
    { data: { sample: [{ value: 43 }] }, field: "value" },
    { data: { nested: { a: 1 } }, field: "nested" },
    { data: { value: 1 }, field: "missing" },
  ];

  it.each(cases)("field $field matches between ctx and branch resolver", ({ data, field }) => {
    const cells = [protocol("p1", "Src"), output("p1", data)];
    const fromBranch = resolveConditionValue(cells, "p1", field);
    const nsData = buildCellNamespace(cells).byId.p1 as Record<string, unknown> | undefined;
    const raw = nsData?.[field];
    const fromNs =
      typeof raw === "number" || typeof raw === "string"
        ? raw
        : raw != null
          ? JSON.stringify(raw)
          : undefined;
    expect(fromNs).toEqual(fromBranch);
  });
});

describe("device-scoped resolution", () => {
  function multiOutput(producedBy: string): WorkbookCell {
    return {
      id: `out-${producedBy}`,
      type: "output",
      isCollapsed: false,
      producedBy,
      data: { sample: [{ value: 1, source: "primary" }] },
      deviceResults: [
        { deviceId: "dev-1", data: { sample: [{ value: 1, source: "primary" }] } },
        { deviceId: "dev-2", data: { sample: [{ value: 2, source: "second" }] } },
        { deviceId: "dev-3", error: "device not open" },
      ],
    };
  }

  it("resolves the matching device's data when deviceId is given", () => {
    const cells = [protocol("p1", "Scan"), multiOutput("p1")];
    expect(resolveOutputData(cells, "p1", "dev-2")).toEqual({ value: 2, source: "second" });
    expect(buildCellNamespace(cells, cells.length, { deviceId: "dev-2" }).ctx.scan).toEqual({
      value: 2,
      source: "second",
    });
  });

  it("falls back to primary data for unknown devices and errored entries", () => {
    const cells = [protocol("p1", "Scan"), multiOutput("p1")];
    expect(resolveOutputData(cells, "p1", "dev-9")).toEqual({ value: 1, source: "primary" });
    expect(resolveOutputData(cells, "p1", "dev-3")).toEqual({ value: 1, source: "primary" });
  });

  it("keeps single-device semantics when no deviceId is given", () => {
    const cells = [protocol("p1", "Scan"), multiOutput("p1")];
    expect(resolveOutputData(cells, "p1")).toEqual({ value: 1, source: "primary" });
  });

  it("propagates an empty device envelope instead of falling back to primary data", () => {
    const cells = [protocol("p1", "Scan"), multiOutput("p1")];
    const outputCell = cells[1] as Extract<WorkbookCell, { type: "output" }>;
    outputCell.deviceResults = [
      ...(outputCell.deviceResults ?? []),
      { deviceId: "dev-empty", data: { sample: [] } },
    ];

    expect(() => resolveOutputData(cells, "p1", "dev-empty")).toThrowError(
      OutputDataNormalizationError,
    );
  });
});

describe("ctx.$device injection", () => {
  const device = { family: "ambit", id: "amb-1", name: "NEW Name Here", index: 1 };

  it("injects the device context under the reserved key", () => {
    const ns = buildCellNamespace([], 0, { device });
    expect(ns.ctx.$device).toEqual(device);
    expect(ns.byId).toEqual({});
  });

  it("is never shadowed by a cell named device ($ is unreachable via names)", () => {
    const cells = [protocol("p1", "$device"), output("p1", { v: 1 })];
    const ns = buildCellNamespace(cells, cells.length, { device });
    // "$device" sanitizes to "device"; the reserved key keeps the runtime value.
    expect(ns.ctx.$device).toEqual(device);
    expect(ns.ctx.device).toEqual({ v: 1 });
  });

  it("omits $device when no device is supplied", () => {
    const ns = buildCellNamespace([], 0);
    expect(ns.ctx.$device).toBeUndefined();
  });
});

describe("duplicate producer names", () => {
  it("lets the nearest upstream producer win the ctx key", () => {
    const cells = [
      protocol("p1", "Scan"),
      output("p1", { v: 1 }),
      protocol("p2", "Scan"),
      output("p2", { v: 2 }),
    ];
    const ns = buildCellNamespace(cells);
    expect(ns.ctx.scan).toEqual({ v: 2 });
    expect(ns.names.scan).toBe("p2");
    expect(ns.byId.p1).toEqual({ v: 1 });
  });
});
