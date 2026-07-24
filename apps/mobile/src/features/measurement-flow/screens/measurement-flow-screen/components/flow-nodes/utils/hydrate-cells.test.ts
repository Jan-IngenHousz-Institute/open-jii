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
  outputsByCellId: {},
  ...over,
});

const provenance = { workbookVersionId: "version-1", executionEpoch: "epoch-1" };

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

  it("hydrates a shared runtime output keyed to its producer", () => {
    const hydrated = hydrateCells(
      [mCell("m1")],
      ctx({
        outputsByCellId: {
          m1: { scope: "shared", provenance, data: { fvfm: 0.72 } },
        },
      }),
    );
    expect(resolveConditionValue(hydrated, "m1", "fvfm")).toBe(0.72);
  });

  it("hydrates every exact device result without display metadata", () => {
    const hydrated = hydrateCells(
      [pCell("p1", "proto-1")],
      ctx({
        outputsByCellId: {
          p1: {
            scope: "device",
            provenance,
            deviceResults: [
              { deviceId: "usb-a", deviceLabel: "A", data: { phi2: 0.8 } },
              { deviceId: "usb-b", deviceLabel: "B", data: { phi2: 0.6 } },
            ],
          },
        },
      }),
    );

    expect(resolveConditionValue(hydrated, "p1", "phi2", { deviceId: "usb-a" })).toBe(0.8);
    expect(resolveConditionValue(hydrated, "p1", "phi2", { deviceId: "usb-b" })).toBe(0.6);
  });

  it("resolves a normalized command response from the registry", () => {
    const hydrated = hydrateCells(
      [cCell("c1")],
      ctx({
        outputsByCellId: {
          c1: {
            scope: "device",
            provenance,
            deviceResults: [{ deviceId: "usb-a", data: { response: "87" } }],
          },
        },
      }),
    );
    expect(resolveConditionValue(hydrated, "c1", "response")).toBe("87");
  });

  it("synthesizes no output when the runtime registry is empty", () => {
    const hydrated = hydrateCells([pCell("p1", "proto-1")], ctx());
    expect(hydrated.some((c) => c.type === "output")).toBe(false);
    expect(resolveConditionValue(hydrated, "p1", "phi2")).toBeUndefined();
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
      ctx({
        outputsByCellId: {
          p1: { scope: "shared", provenance, data: { phi2: 0.9 } },
        },
      }),
    );
    expect(hydrated.filter((c) => c.type === "output")).toHaveLength(1);
    expect(resolveConditionValue(hydrated, "p1", "phi2")).toBe(0.9);
  });

  it("does not mutate the original cells", () => {
    const cells = [qCell("q1")];
    hydrateCells(cells, ctx({ getAnswer: () => "x" }));
    expect(cells[0].answer).toBeUndefined();
  });

  it("synthesizes outputs for every retained producer", () => {
    const hydrated = hydrateCells(
      [pCell("p1", "proto-1"), mCell("m1")],
      ctx({
        outputsByCellId: {
          p1: { scope: "shared", provenance, data: { phi2: 0.8 } },
          m1: { scope: "shared", provenance, data: { fvfm: 0.72 } },
        },
      }),
    );
    expect(resolveConditionValue(hydrated, "p1", "phi2")).toBe(0.8);
    expect(resolveConditionValue(hydrated, "m1", "fvfm")).toBe(0.72);
  });
});
