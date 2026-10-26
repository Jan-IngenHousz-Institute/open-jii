import { createExportRecord } from "@/test/factories";
import { act, renderHook } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { ExperimentExportRecord } from "@repo/api/domains/experiment/experiment.schema";
import { toast } from "@repo/ui/hooks/use-toast";

import { useActivity } from "./activity-context";
import { useTrackExports } from "./use-track-exports";

function track(exports: ExperimentExportRecord[]) {
  return renderHook(
    (props: { exports: ExperimentExportRecord[] }) => {
      useTrackExports({
        experimentId: "exp-1",
        tableName: "centrum",
        displayName: "Light Response",
        exports: props.exports,
      });
      return useActivity();
    },
    { initialProps: { exports } },
  );
}

function lastToastArg() {
  return vi.mocked(toast).mock.lastCall?.[0];
}

const running = createExportRecord({
  exportId: "x1",
  status: "running",
  format: "csv",
  createdAt: "2026-01-01T00:00:00.000Z",
  completedAt: null,
});

beforeEach(() => vi.clearAllMocks());

describe("useTrackExports", () => {
  it("mirrors export records into the activity context, one entry per export", () => {
    const { result } = track([running, createExportRecord({ exportId: "x2" })]);

    expect(result.current.entries.map((entry) => entry.id).sort()).toEqual([
      "export-x1",
      "export-x2",
    ]);
    const entry = result.current.entries.find((candidate) => candidate.id === "export-x1");
    expect(entry).toMatchObject({
      kind: "data_export",
      title: "experimentData.exportModal.activityTitle",
      status: "running",
      format: "csv",
    });
  });

  it("fires a toast on the running → succeeded transition", () => {
    const { rerender } = track([running]);
    expect(toast).not.toHaveBeenCalled();

    act(() =>
      rerender({
        exports: [{ ...running, status: "completed", completedAt: "2026-01-01T00:05:00.000Z" }],
      }),
    );

    expect(toast).toHaveBeenCalledTimes(1);
    expect(lastToastArg()?.description).toBe("experimentData.exportModal.exportReady");
  });

  it("fires a destructive toast on the running → failed transition", () => {
    const { rerender } = track([{ ...running, format: "parquet" }]);

    act(() =>
      rerender({
        exports: [
          {
            ...running,
            format: "parquet",
            status: "failed",
            errorCode: "unknown",
            completedAt: "2026-01-01T00:05:00.000Z",
          },
        ],
      }),
    );

    expect(lastToastArg()?.description).toBe("experimentData.exportModal.exportFailed");
    expect(lastToastArg()?.variant).toBe("destructive");
  });

  it("stays quiet when a completed export expires", () => {
    const completed = createExportRecord({ ...running, status: "completed" });
    const { rerender } = track([completed]);

    act(() => rerender({ exports: [{ ...completed, status: "expired" }] }));

    expect(toast).not.toHaveBeenCalled();
  });
});
