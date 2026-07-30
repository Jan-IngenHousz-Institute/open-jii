import { describe, expect, it, vi } from "vitest";

import type {
  CommandCell,
  MacroCell,
  OutputCell,
  ProtocolCell,
  QuestionCell,
  WorkbookCell,
} from "@repo/api/domains/workbook/workbook-cells.schema";
import { resolveConditionValue } from "@repo/api/transforms/evaluate-branch";

import { hydrateCells } from "./hydrate-cells";
import type { HydrationContext } from "./hydrate-cells";

const qCell = (id: string): QuestionCell => ({
  id,
  type: "question",
  isCollapsed: false,
  name: id,
  question: { kind: "number", text: id, required: false },
  isAnswered: false,
});
const pCell = (id: string, protocolId: string): ProtocolCell => ({
  id,
  type: "protocol",
  isCollapsed: false,
  payload: { protocolId, version: 1 },
});
const cCell = (id: string): CommandCell => ({
  id,
  type: "command",
  isCollapsed: false,
  payload: { format: "string", content: "battery" },
});
const mCell = (id: string): MacroCell => ({
  id,
  type: "macro",
  isCollapsed: false,
  payload: { macroId: "00000000-0000-0000-0000-000000000001", language: "javascript" },
});

const ctx = (over: Partial<HydrationContext> = {}): HydrationContext => ({
  iterationCount: 0,
  getAnswer: () => undefined,
  ...over,
});

describe("hydrateCells", () => {
  it("fills question answers from the answers store", () => {
    const getAnswer = vi.fn((_c: number, id: string) => (id === "q1" ? "42" : undefined));
    const hydrated = hydrateCells([qCell("q1")], ctx({ getAnswer }));
    expect(resolveConditionValue(hydrated, "q1", "answer")).toBe("42");
  });

  it("leaves unanswered questions unresolved", () => {
    const hydrated = hydrateCells([qCell("q1")], ctx());
    expect(resolveConditionValue(hydrated, "q1", "answer")).toBeUndefined();
  });

  it("stores the raw latest measurement on the output cell keyed to its producer", () => {
    const raw = { sample: [{ phi2: 0.8 }] };
    const hydrated = hydrateCells(
      [pCell("p1", "proto-1")],
      ctx({ scanResult: raw, producerCellId: "p1" }),
    );
    const output = hydrated.find((cell): cell is OutputCell => cell.type === "output");
    expect(output?.data).toBe(raw);
    expect(resolveConditionValue(hydrated, "p1", "phi2")).toBe(0.8);
  });

  it("stores each device's raw live measurement without protocol-specific reshaping", () => {
    const first = { sample: [{ phi2: 0.8 }] };
    const second = { sample: [{ phi2: 0.6 }] };
    const hydrated = hydrateCells(
      [pCell("p1", "proto-1")],
      ctx({
        scanResult: first,
        scanResults: [
          { device: { id: "usb-a", name: "A" }, result: first },
          { device: { id: "usb-b", name: "B" }, result: second },
        ],
        producerCellId: "p1",
      }),
    );

    const output = hydrated.find((cell): cell is OutputCell => cell.type === "output");
    expect(output?.data).toBe(first);
    expect(output?.deviceResults).toEqual([
      { deviceId: "usb-a", deviceLabel: "A", data: first },
      { deviceId: "usb-b", deviceLabel: "B", data: second },
    ]);
    expect(resolveConditionValue(hydrated, "p1", "phi2", { deviceId: "usb-a" })).toBe(0.8);
    expect(resolveConditionValue(hydrated, "p1", "phi2", { deviceId: "usb-b" })).toBe(0.6);
  });

  it("wraps a scalar command result under `response` (mirrors web) so a branch resolves it", () => {
    const hydrated = hydrateCells([cCell("c1")], ctx({ scanResult: "87", producerCellId: "c1" }));
    expect(resolveConditionValue(hydrated, "c1", "response")).toBe("87");
  });

  it("passes an object command result through so its fields resolve directly", () => {
    const hydrated = hydrateCells(
      [cCell("c1")],
      ctx({ scanResult: { voltage: 3.9 }, producerCellId: "c1" }),
    );
    expect(resolveConditionValue(hydrated, "c1", "voltage")).toBe(3.9);
  });

  it("keeps a non-array sample envelope raw", () => {
    const raw = { sample: { phi2: 0.5 } };
    const hydrated = hydrateCells(
      [pCell("p1", "proto-1")],
      ctx({ scanResult: raw, producerCellId: "p1" }),
    );
    const output = hydrated.find((cell): cell is OutputCell => cell.type === "output");
    expect(output?.data).toBe(raw);
    expect(resolveConditionValue(hydrated, "p1", "phi2")).toBe(0.5);
  });

  it("synthesizes no output when there is no scan result", () => {
    const hydrated = hydrateCells([pCell("p1", "proto-1")], ctx({ producerCellId: "p1" }));
    expect(hydrated.some((c) => c.type === "output")).toBe(false);
    expect(resolveConditionValue(hydrated, "p1", "phi2")).toBeUndefined();
  });

  it("synthesizes no output when no cell matches the producer id", () => {
    const hydrated = hydrateCells(
      [pCell("p1", "proto-1")],
      ctx({ scanResult: { sample: [{ phi2: 0.8 }] }, producerCellId: "p-OTHER" }),
    );
    expect(hydrated.some((c) => c.type === "output")).toBe(false);
  });

  it("replaces a stale output for the same producer instead of duplicating it", () => {
    const stale: OutputCell = {
      id: "o1",
      type: "output",
      isCollapsed: false,
      producedBy: "p1",
      data: [{ phi2: 0.1 }],
    };
    const cells: WorkbookCell[] = [pCell("p1", "proto-1"), stale];
    const hydrated = hydrateCells(
      cells,
      ctx({ scanResult: { sample: [{ phi2: 0.9 }] }, producerCellId: "p1" }),
    );
    expect(hydrated.filter((c) => c.type === "output")).toHaveLength(1);
    const output = hydrated.find((cell): cell is OutputCell => cell.type === "output");
    expect(output?.data).toEqual({ sample: [{ phi2: 0.9 }] });
    expect(resolveConditionValue(hydrated, "p1", "phi2")).toBe(0.9);
  });

  it("does not mutate the original cells", () => {
    const cells = [qCell("q1")];
    hydrateCells(cells, ctx({ getAnswer: () => "x" }));
    expect(cells[0].answer).toBeUndefined();
  });

  it("synthesizes output cells from cellOutputs (macro results)", () => {
    const hydrated = hydrateCells([mCell("m1")], ctx({ cellOutputs: { m1: { fvfm: 0.72 } } }));
    expect(resolveConditionValue(hydrated, "m1", "fvfm")).toBe(0.72);
  });

  it("synthesizes both a macro output and the latest scan", () => {
    const hydrated = hydrateCells(
      [pCell("p1", "proto-1"), mCell("m1")],
      ctx({
        scanResult: { sample: [{ phi2: 0.8 }] },
        producerCellId: "p1",
        cellOutputs: { m1: { fvfm: 0.72 } },
      }),
    );
    const protocolOutput = hydrated.find(
      (cell): cell is OutputCell => cell.type === "output" && cell.producedBy === "p1",
    );
    expect(protocolOutput?.data).toEqual({ sample: [{ phi2: 0.8 }] });
    expect(resolveConditionValue(hydrated, "p1", "phi2")).toBe(0.8);
    expect(resolveConditionValue(hydrated, "m1", "fvfm")).toBe(0.72);
  });

  it("prefers the live scan over a stored cellOutputs entry for the same producer", () => {
    const hydrated = hydrateCells(
      [pCell("p1", "proto-1")],
      ctx({
        scanResult: { sample: [{ phi2: 0.9 }] },
        producerCellId: "p1",
        cellOutputs: { p1: { phi2: 0.1 } },
      }),
    );
    expect(hydrated.filter((c) => c.type === "output")).toHaveLength(1);
    const output = hydrated.find((cell): cell is OutputCell => cell.type === "output");
    expect(output?.data).toEqual({ sample: [{ phi2: 0.9 }] });
    expect(resolveConditionValue(hydrated, "p1", "phi2")).toBe(0.9);
  });
});
