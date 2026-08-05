import { describe, expect, it } from "vitest";

import type { RunnerCell } from "../cells";
import { hashCells, parseSnapshot, SnapshotError, toSnapshot } from "./snapshot";
import { createInitialState } from "./state";

const cells: RunnerCell[] = [
  { id: "m1", type: "markdown", isCollapsed: false, content: "hi" },
  {
    id: "c1",
    type: "command",
    isCollapsed: false,
    payload: { format: "string", content: "battery" },
  },
];

describe("toSnapshot", () => {
  it("is valid JSON that parseSnapshot accepts back, ref-shaped outputs intact", () => {
    const snapshot = toSnapshot(createInitialState({ cells }), 42);
    snapshot.state.outputs.c1 = { ref: "mem:c1" };
    const roundTripped: unknown = JSON.parse(JSON.stringify(snapshot));
    expect(parseSnapshot(roundTripped)).toEqual(snapshot);
    expect(snapshot.schemaVersion).toBe(2);
    expect(snapshot.savedAt).toBe(42);
    expect(parseSnapshot(roundTripped).state.outputs.c1).toEqual({ ref: "mem:c1" });
  });

  it("strips volatile progress and re-arms every in-flight owner as interrupted", () => {
    const base = createInitialState({ cells });
    const state = {
      ...base,
      inFlight: {
        e1: {
          effectId: "e1",
          trackId: "main",
          cellId: "c1",
          phase: "runCommand" as const,
        },
      },
      cellRuns: { c1: { status: "running" as const, executionOrder: [1] } },
      tracks: {
        main: {
          ...base.tracks.main,
          cursor: { ...base.tracks.main.cursor, cellId: "c1" },
          progress: {
            phase: "receiving" as const,
            chunks: 1,
            bytes: 64,
            elapsedMs: 5,
            lastEventAt: 0,
          },
        },
      },
    };
    const snapshot = toSnapshot(state, 0);
    expect(snapshot.state.tracks.main.progress).toBeNull();
    expect(snapshot.state.inFlight).toEqual({});
    expect(snapshot.state.status).toBe("awaitingInput");
    expect(snapshot.state.tracks.main.pendingInteraction).toEqual({
      kind: "resume",
      cellId: "c1",
    });
    expect(snapshot.state.cellRuns.c1).toEqual({ status: "interrupted", executionOrder: [1] });
  });

  it("re-arms a dispatch step onto its owning macro cell", () => {
    const base = createInitialState({ cells });
    const state = {
      ...base,
      inFlight: {
        e2: {
          effectId: "e2",
          trackId: "main",
          cellId: "a1__dispatch",
          phase: "runCommand" as const,
        },
      },
      tracks: {
        main: {
          ...base.tracks.main,
          cursor: { ...base.tracks.main.cursor, cellId: "a1" },
        },
      },
    };
    const snapshot = toSnapshot(state, 0);
    expect(snapshot.state.cellRuns.a1?.status).toBe("interrupted");
    expect(snapshot.state.cellRuns.a1__dispatch?.status).toBe("interrupted");
    expect(snapshot.state.tracks.main.cursor.cellId).toBe("a1");
  });
});

describe("parseSnapshot", () => {
  it("losslessly migrates a normalized v1 paused run into tracks.main", () => {
    const v1 = {
      schemaVersion: 1,
      savedAt: 7,
      cellsHash: hashCells(cells),
      state: {
        schemaVersion: 1,
        mode: "flow",
        options: {
          loop: false,
          maxBranchVisits: 100,
          allowDeviceWrites: false,
        },
        cells,
        status: "awaitingInput",
        position: { cellId: "c1", enteredVia: "forward", atStart: false },
        runAllActive: false,
        stopRequested: false,
        cycle: 0,
        answersByCycle: [{}],
        outputs: { c1: { v: { prior: true }, messages: ["kept"] } },
        branchVisits: { b1: 2 },
        returnStack: [{ landingCellId: "c1", returnToCellId: "m1" }],
        cellRuns: { c1: { status: "interrupted", executionOrder: [3] } },
        execCounter: 3,
        effectSeq: 9,
        inFlight: null,
        devices: [],
        dispatch: null,
        dispatchConsumed: { c1: true },
        progress: null,
        fatalReason: null,
        trace: [],
      },
    };

    const migrated = parseSnapshot(v1);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.state.schemaVersion).toBe(2);
    expect(migrated.state.tracks.main.cursor.cellId).toBe("c1");
    expect(migrated.state.tracks.main.branchVisits).toEqual({ b1: 2 });
    expect(migrated.state.tracks.main.returnStack).toEqual([
      { landingCellId: "c1", returnToCellId: "m1" },
    ]);
    expect(migrated.state.tracks.main.dispatchConsumed).toEqual({ c1: true });
    expect(migrated.state.tracks.main.pendingInteraction).toEqual({
      kind: "resume",
      cellId: "c1",
    });
    // Old v1 writers already normalized live effects to interrupted/null;
    // migration preserves that safe re-arm state exactly.
    expect(migrated.state.cellRuns.c1).toEqual({ status: "interrupted", executionOrder: [3] });
    expect(migrated.state.inFlight).toEqual({});
    expect(migrated.state.outputs.c1).toEqual({ v: { prior: true }, messages: ["kept"] });

    const pausedError = {
      ...v1,
      state: {
        ...v1.state,
        status: "pausedError",
        cellRuns: {
          ...v1.state.cellRuns,
          c1: {
            status: "error",
            error: "still actionable",
            executionOrder: [3],
          },
        },
      },
    };
    const migratedError = parseSnapshot(pausedError);
    expect(migratedError.state.status).toBe("pausedError");
    expect(migratedError.state.tracks.main.pendingInteraction).toEqual({
      kind: "error",
      cellId: "c1",
    });
    expect(migratedError.state.tracks.main.terminalReason).toBe("still actionable");
  });

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
    for (const version of [3, 0]) {
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
