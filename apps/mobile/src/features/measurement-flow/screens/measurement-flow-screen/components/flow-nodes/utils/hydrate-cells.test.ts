import { describe, expect, it, vi } from "vitest";

import type {
  OutputCell,
  ProtocolCell,
  QuestionCell,
  WorkbookCell,
} from "@repo/api/schemas/workbook-cells.schema";
import { resolveConditionValue } from "@repo/api/utils/evaluate-branch";

import { hydrateCells } from "./hydrate-cells";
import type { HydrationContext } from "./hydrate-cells";

const qCell = (id: string): QuestionCell => ({
  id,
  type: "question",
  isCollapsed: false,
  name: id,
  question: { kind: "number", text: id, required: false } as QuestionCell["question"],
  isAnswered: false,
});
const pCell = (id: string, protocolId: string): ProtocolCell => ({
  id,
  type: "protocol",
  isCollapsed: false,
  payload: { protocolId, version: 1 },
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

  it("attaches the latest measurement as an output cell keyed to its protocol", () => {
    const hydrated = hydrateCells(
      [pCell("p1", "proto-1")],
      ctx({ scanResult: { sample: [{ phi2: 0.8 }] }, protocolId: "proto-1" }),
    );
    expect(resolveConditionValue(hydrated, "p1", "phi2")).toBe(0.8);
  });

  it("wraps a non-array sample", () => {
    const hydrated = hydrateCells(
      [pCell("p1", "proto-1")],
      ctx({ scanResult: { sample: { phi2: 0.5 } }, protocolId: "proto-1" }),
    );
    expect(resolveConditionValue(hydrated, "p1", "phi2")).toBe(0.5);
  });

  it("synthesizes no output when there is no scan result", () => {
    const hydrated = hydrateCells([pCell("p1", "proto-1")], ctx({ protocolId: "proto-1" }));
    expect(hydrated.some((c) => c.type === "output")).toBe(false);
    expect(resolveConditionValue(hydrated, "p1", "phi2")).toBeUndefined();
  });

  it("synthesizes no output when no protocol cell matches the scanned protocol", () => {
    const hydrated = hydrateCells(
      [pCell("p1", "proto-1")],
      ctx({ scanResult: { sample: [{ phi2: 0.8 }] }, protocolId: "proto-OTHER" }),
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
      ctx({ scanResult: { sample: [{ phi2: 0.9 }] }, protocolId: "proto-1" }),
    );
    expect(hydrated.filter((c) => c.type === "output")).toHaveLength(1);
    expect(resolveConditionValue(hydrated, "p1", "phi2")).toBe(0.9);
  });

  it("does not mutate the original cells", () => {
    const cells = [qCell("q1")];
    hydrateCells(cells, ctx({ getAnswer: () => "x" }));
    expect(cells[0].answer).toBeUndefined();
  });
});
