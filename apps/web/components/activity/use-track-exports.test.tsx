import { act, renderHook } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { ExperimentExportRecord } from "@repo/api/domains/experiment/experiment.schema";
import { toast } from "@repo/ui/hooks/use-toast";

import { useActivity } from "./activity-context";
import { useTrackExports } from "./use-track-exports";

interface ExportLike {
  exportId?: string;
  status: string;
  format: string;
  createdAt: string;
  completedAt: string | null;
}

function track(exports: ExportLike[]) {
  return renderHook(
    (props: { exports: ExportLike[] }) => {
      useTrackExports({
        experimentId: "exp-1",
        tableName: "centrum",
        displayName: "Light Response",
        exports: props.exports as unknown as ExperimentExportRecord[],
      });
      return useActivity();
    },
    { initialProps: { exports } },
  );
}

function lastToastArg() {
  return vi.mocked(toast).mock.lastCall?.[0] as
    | { description?: string; variant?: string }
    | undefined;
}

beforeEach(() => vi.clearAllMocks());

describe("useTrackExports", () => {
  it("mirrors export records into the activity context", () => {
    const { result } = track([
      {
        exportId: "x1",
        status: "running",
        format: "csv",
        createdAt: "2026-01-01T00:00:00.000Z",
        completedAt: null,
      },
    ]);
    expect(result.current.entries).toHaveLength(1);
    const entry = result.current.entries[0];
    expect(entry.kind).toBe("data_export");
    expect(entry.title).toBe("Export of Light Response (CSV)");
    expect(entry.resultUrl).toContain("/api/v1/experiments/");
    expect(entry.resultUrl).toContain("/data/exports/x1");
  });

  it("fires a toast on the running → succeeded transition", () => {
    const { rerender } = track([
      {
        exportId: "x1",
        status: "running",
        format: "csv",
        createdAt: "2026-01-01T00:00:00.000Z",
        completedAt: null,
      },
    ]);
    expect(toast).not.toHaveBeenCalled();
    act(() =>
      rerender({
        exports: [
          {
            exportId: "x1",
            status: "completed",
            format: "csv",
            createdAt: "2026-01-01T00:00:00.000Z",
            completedAt: "2026-01-01T00:05:00.000Z",
          },
        ],
      }),
    );
    expect(toast).toHaveBeenCalledTimes(1);
    expect(lastToastArg()?.description).toContain("ready to download");
  });

  it("keeps a single entry when exportId appears after the first poll", () => {
    const { result, rerender } = track([
      {
        status: "running",
        format: "csv",
        createdAt: "2026-02-01T00:00:00.000Z",
        completedAt: null,
      },
    ]);
    expect(result.current.entries).toHaveLength(1);
    act(() =>
      rerender({
        exports: [
          {
            exportId: "x9",
            status: "running",
            format: "csv",
            createdAt: "2026-02-01T00:00:00.000Z",
            completedAt: null,
          },
        ],
      }),
    );
    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0]?.resultUrl).toContain("/data/exports/x9");
  });

  it("fires a destructive toast on the running → failed transition", () => {
    const { rerender } = track([
      {
        exportId: "x1",
        status: "running",
        format: "parquet",
        createdAt: "2026-01-01T00:00:00.000Z",
        completedAt: null,
      },
    ]);
    act(() =>
      rerender({
        exports: [
          {
            exportId: "x1",
            status: "failed",
            format: "parquet",
            createdAt: "2026-01-01T00:00:00.000Z",
            completedAt: null,
          },
        ],
      }),
    );
    expect(lastToastArg()?.variant).toBe("destructive");
  });
});
