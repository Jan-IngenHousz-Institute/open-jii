import { createExportRecord } from "@/test/factories";
import { server } from "@/test/msw/server";
import { act, renderHook, waitFor } from "@/test/test-utils";
import { afterEach, describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { useListExports } from "./useListExports";

describe("useListExports", () => {
  const experimentId = "test-experiment-id";
  const tableName = "raw_data";

  afterEach(() => {
    vi.useRealTimers();
  });

  it("polls while an export runs and stops once every export finished", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const running = createExportRecord({ experimentId, tableName, status: "running" });
    const completed = createExportRecord({ ...running, status: "completed" });
    const spy = server.mount(contract.experiments.listExports, {
      body: () => ({ exports: [spy.callCount > 1 ? completed : running] }),
    });

    const { result } = renderHook(() => useListExports({ experimentId, tableName }));
    await waitFor(() => expect(result.current.data?.exports[0]?.status).toBe("running"));

    await act(() => vi.advanceTimersByTimeAsync(15_000));
    await waitFor(() => expect(result.current.data?.exports[0]?.status).toBe("completed"));
    const callsWhenFinished = spy.callCount;

    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(spy.callCount).toBe(callsWhenFinished);
  });

  it("fetches exports", async () => {
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
      expect(result.current.data?.exports).toEqual(mockExports);
    });

    expect(spy.params.id).toBe(experimentId);
  });

  it("returns empty exports array", async () => {
    server.mount(contract.experiments.listExports, {
      body: { exports: [] },
    });

    const { result } = renderHook(() => useListExports({ experimentId, tableName }));

    await waitFor(() => {
      expect(result.current.data?.exports).toEqual([]);
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
      expect(result.current.data?.exports).toEqual(mockExports);
    });
    expect(result.current.data?.exports[0]?.exportId).toBeNull();
    expect(result.current.data?.exports[0]?.status).toBe("running");
  });
});
