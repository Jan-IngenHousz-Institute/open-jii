import { describe, expect, it } from "vitest";

import type { RunnerCell } from "../cells";
import { hashCells, parseSnapshot, SnapshotError, toSnapshot } from "./snapshot";
import { createInitialState } from "./state";

const cells: RunnerCell[] = [
  { id: "m1", type: "markdown", isCollapsed: false, content: "hi" },
  { id: "c1", type: "command", payload: { format: "string", content: "battery" } },
];

describe("toSnapshot", () => {
  it("is valid JSON that parseSnapshot accepts back, ref-shaped outputs intact", () => {
    const snapshot = toSnapshot(createInitialState({ cells }), 42);
    snapshot.state.outputs.c1 = { ref: "mem:c1" };
    const roundTripped: unknown = JSON.parse(JSON.stringify(snapshot));
    expect(parseSnapshot(roundTripped)).toEqual(snapshot);
    expect(snapshot.savedAt).toBe(42);
    expect(parseSnapshot(roundTripped).state.outputs.c1).toEqual({ ref: "mem:c1" });
  });

  it("strips volatile progress and re-arms in-flight work as interrupted", () => {
    const state = {
      ...createInitialState({ cells }),
      status: "running" as const,
      position: { cellId: "c1", enteredVia: "forward" as const, atStart: false },
      inFlight: { effectId: "e1", cellId: "c1", kind: "runCommand" as const },
      cellRuns: { c1: { status: "running" as const, executionOrder: [1] } },
      progress: { phase: "receiving" as const, chunks: 1, bytes: 64, elapsedMs: 5, lastEventAt: 0 },
    };
    const snapshot = toSnapshot(state, 0);
    expect(snapshot.state.progress).toBeNull();
    expect(snapshot.state.inFlight).toBeNull();
    expect(snapshot.state.status).toBe("awaitingInput");
    expect(snapshot.state.cellRuns.c1).toEqual({ status: "interrupted", executionOrder: [1] });
  });

  it("re-arms a dispatch step onto its owning macro cell", () => {
    const state = {
      ...createInitialState({ cells }),
      status: "running" as const,
      position: { cellId: "a1", enteredVia: "forward" as const, atStart: false },
      inFlight: { effectId: "e2", cellId: "a1__dispatch", kind: "runCommand" as const },
    };
    const snapshot = toSnapshot(state, 0);
    expect(snapshot.state.cellRuns.a1?.status).toBe("interrupted");
    expect(snapshot.state.cellRuns.a1__dispatch?.status).toBe("interrupted");
    expect(snapshot.state.position.cellId).toBe("a1");
  });
});

describe("parseSnapshot", () => {
  it("rejects invalid payloads and unsupported schema versions with typed errors", () => {
    for (const bad of [null, "x", 42, {}, { schemaVersion: "1" }]) {
      try {
        parseSnapshot(bad);
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(SnapshotError);
        expect((error as SnapshotError).code).toBe("invalid");
      }
    }
    // Newer versions and unmigratable older versions both refuse.
    for (const version of [2, 0]) {
      expect(() => parseSnapshot({ schemaVersion: version })).toThrowError(
        expect.objectContaining({ code: "unsupportedVersion" }) as Error,
      );
    }
  });
});

describe("hashCells", () => {
  it("is stable for equal programs and differs when cells change", () => {
    expect(hashCells(cells)).toBe(hashCells(JSON.parse(JSON.stringify(cells))));
    const edited = [cells[0], { ...cells[1], payload: { format: "string", content: "hello" } }];
    expect(hashCells(edited)).not.toBe(hashCells(cells));
  });
});
