/**
 * useListExports hook test — MSW-based.
 *
 * The real hook calls `tsr.experiments.listExports.useQuery` →
 * `GET /api/v1/experiments/:id/data/exports?tableName=…`. MSW intercepts that request.
 */
import { createExportRecord } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api";

import { useListExports } from "./useListExports";

describe("useListExports", () => {
  const experimentId = "test-experiment-id";
  const tableName = "raw_data";

  it("fetches exports from MSW", async () => {
    const mockExports = [
      createExportRecord({
        exportId: "export-1",
        experimentId,
        tableName,
        format: "csv",
        status: "completed",
        filePath: "/path/to/file.csv",
        rowCount: 100,
        fileSize: 1024,
        createdAt: "2024-01-01T00:00:00Z",
        completedAt: "2024-01-01T00:05:00Z",
      }),
    ];

    const spy = server.mount(contract.experiments.listExports, {
      body: { exports: mockExports },
    });

    const { result } = renderHook(() => useListExports({ experimentId, tableName }));

    await waitFor(() => {
      expect(result.current.data?.body.exports).toEqual(mockExports);
    });

    expect(spy.params.id).toBe(experimentId);
  });

  it("returns empty exports array", async () => {
    server.mount(contract.experiments.listExports, {
      body: { exports: [] },
    });

    const { result } = renderHook(() => useListExports({ experimentId, tableName }));

    await waitFor(() => {
      expect(result.current.data?.body.exports).toEqual([]);
    });
  });

  it("handles error state", async () => {
    server.mount(contract.experiments.listExports, { status: 500 });

    const { result } = renderHook(() => useListExports({ experimentId, tableName }));

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
  });

  it("handles active exports without exportId", async () => {
    const mockExports = [
      createExportRecord({
        exportId: null,
        experimentId,
        tableName,
        format: "ndjson",
        status: "running",
        filePath: null,
        rowCount: null,
        fileSize: null,
        createdAt: "2024-01-01T00:00:00Z",
        completedAt: null,
      }),
    ];

    server.mount(contract.experiments.listExports, {
      body: { exports: mockExports },
    });

    const { result } = renderHook(() => useListExports({ experimentId, tableName }));

    await waitFor(() => {
      expect(result.current.data?.body.exports).toEqual(mockExports);
    });
    expect(result.current.data?.body.exports[0]?.exportId).toBeNull();
    expect(result.current.data?.body.exports[0]?.status).toBe("running");
  });
});
