import { orpc } from "@/lib/orpc";
import { createExperimentTable } from "@/test/factories";
import { server } from "@/test/msw/server";
import { act, createTestQueryClient, renderHook, waitFor } from "@/test/test-utils";
import { useQuery } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { useExperimentDataFreshness } from "./useExperimentDataFreshness";

const RAW = createExperimentTable({
  identifier: "raw_data",
  totalRows: 10,
  latestRowAt: "2026-09-22T10:05:00.000Z",
  schemaRevision: "schema-1",
});
const MACRO = createExperimentTable({
  identifier: "macro-1",
  tableType: "macro",
  totalRows: 4,
  latestRowAt: "2026-09-22T10:07:00.000Z",
  schemaRevision: "schema-1",
});

function dataKey(tableName: string) {
  return orpc.experiments.getExperimentData.queryKey({
    input: { id: "exp-1", tableName, page: 1, pageSize: 10 },
  });
}

describe("useExperimentDataFreshness", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("refetches only the tables whose count or newest row moved", async () => {
    const queryClient = createTestQueryClient();
    // Nothing observes the seeded reads, so keep them past the test client's gcTime of 0.
    queryClient.setQueryDefaults(orpc.experiments.getExperimentData.key(), { gcTime: Infinity });
    queryClient.setQueryData(dataKey("raw_data"), []);
    queryClient.setQueryData(dataKey("macro-1"), []);
    const moved = { ...RAW, totalRows: 11, latestRowAt: "2026-09-22T10:08:00.000Z" };
    const spy = server.mount(contract.experiments.getExperimentTables, {
      body: () => (spy.callCount > 1 ? [moved, MACRO] : [RAW, MACRO]),
    });

    const { result } = renderHook(() => useExperimentDataFreshness("exp-1"), { queryClient });
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));

    await act(() =>
      queryClient.refetchQueries({ queryKey: orpc.experiments.getExperimentTables.key() }),
    );

    await waitFor(() =>
      expect(queryClient.getQueryState(dataKey("raw_data"))?.isInvalidated).toBe(true),
    );
    expect(queryClient.getQueryState(dataKey("macro-1"))?.isInvalidated).toBe(false);
  });

  it("refetches a table whose schema changed after its rows did", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryDefaults(orpc.experiments.getExperimentData.key(), { gcTime: Infinity });
    queryClient.setQueryData(dataKey("raw_data"), []);
    const widened = { ...RAW, schemaRevision: "schema-2" };
    const spy = server.mount(contract.experiments.getExperimentTables, {
      body: () => (spy.callCount > 1 ? [widened] : [RAW]),
    });

    const { result } = renderHook(() => useExperimentDataFreshness("exp-1"), { queryClient });
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));

    await act(() =>
      queryClient.refetchQueries({ queryKey: orpc.experiments.getExperimentTables.key() }),
    );

    await waitFor(() =>
      expect(queryClient.getQueryState(dataKey("raw_data"))?.isInvalidated).toBe(true),
    );
  });

  it("retries rows whose refresh failed on the next poll, though nothing moved", async () => {
    const queryClient = createTestQueryClient();
    server.mount(contract.experiments.getExperimentTables, { body: [RAW] });
    server.mount(contract.experiments.getExperimentData, { status: 500 });

    const { result } = renderHook(
      () => {
        const freshness = useExperimentDataFreshness("exp-1");
        const rows = useQuery(
          orpc.experiments.getExperimentData.queryOptions({
            input: { id: "exp-1", tableName: "raw_data", page: 1, pageSize: 10 },
          }),
        );
        return { freshness, rows };
      },
      { queryClient },
    );
    await waitFor(() => expect(result.current.rows.isError).toBe(true));

    const rowsSpy = server.mount(contract.experiments.getExperimentData, { body: [] });
    await act(() =>
      queryClient.refetchQueries({ queryKey: orpc.experiments.getExperimentTables.key() }),
    );

    await waitFor(() => expect(rowsSpy.callCount).toBe(1));
    await waitFor(() => expect(result.current.rows.isError).toBe(false));
  });

  it("holds the rows and their newest time still while paused, and applies what moved on resume", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryDefaults(orpc.experiments.getExperimentData.key(), { gcTime: Infinity });
    queryClient.setQueryData(dataKey("raw_data"), []);
    const moved = { ...RAW, totalRows: 11, latestRowAt: "2026-09-22T10:09:00.000Z" };
    const spy = server.mount(contract.experiments.getExperimentTables, {
      body: () => (spy.callCount > 1 ? [moved] : [RAW]),
    });

    const { result } = renderHook(() => useExperimentDataFreshness("exp-1"), { queryClient });
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    act(() => result.current.togglePaused());

    // Another screen sharing the listing refetches it during the pause.
    await act(() =>
      queryClient.refetchQueries({ queryKey: orpc.experiments.getExperimentTables.key() }),
    );
    expect(queryClient.getQueryState(dataKey("raw_data"))?.isInvalidated).toBe(false);
    expect(result.current.newestRowAt).toBe(RAW.latestRowAt);

    act(() => result.current.togglePaused());

    await waitFor(() =>
      expect(queryClient.getQueryState(dataKey("raw_data"))?.isInvalidated).toBe(true),
    );
    expect(result.current.newestRowAt).toBe("2026-09-22T10:09:00.000Z");
  });

  it("reports the asked tables' newest data, or the experiment's without any", async () => {
    const newer = createExperimentTable({
      identifier: "macro-2",
      tableType: "macro",
      latestRowAt: "2026-09-22T10:09:00.000Z",
    });
    server.mount(contract.experiments.getExperimentTables, { body: [RAW, MACRO, newer] });

    const { result: one } = renderHook(() => useExperimentDataFreshness("exp-1", ["raw_data"]));
    const { result: two } = renderHook(() =>
      useExperimentDataFreshness("exp-1", ["raw_data", "macro-1"]),
    );
    const { result: experiment } = renderHook(() => useExperimentDataFreshness("exp-1"));

    await waitFor(() => expect(one.current.newestRowAt).toBe("2026-09-22T10:05:00.000Z"));
    await waitFor(() => expect(two.current.newestRowAt).toBe("2026-09-22T10:07:00.000Z"));
    await waitFor(() => expect(experiment.current.newestRowAt).toBe("2026-09-22T10:09:00.000Z"));
  });

  it("reports no newest row for an experiment without rows", async () => {
    server.mount(contract.experiments.getExperimentTables, { body: [] });

    const { result } = renderHook(() => useExperimentDataFreshness("exp-1"));

    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    expect(result.current.newestRowAt).toBeNull();
    expect(result.current.status).toBe("live");
  });

  it("pauses, and catches up at once on resume", async () => {
    const spy = server.mount(contract.experiments.getExperimentTables, { body: [RAW] });

    const { result } = renderHook(() => useExperimentDataFreshness("exp-1"));
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));

    act(() => result.current.togglePaused());
    expect(result.current.status).toBe("paused");
    const callsWhilePaused = spy.callCount;

    act(() => result.current.togglePaused());
    expect(result.current.status).toBe("live");
    await waitFor(() => expect(spy.callCount).toBe(callsWhilePaused + 1));
  });

  it("stops polling after ten idle minutes and catches up on the next input", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const spy = server.mount(contract.experiments.getExperimentTables, { body: [RAW] });

    const { result } = renderHook(() => useExperimentDataFreshness("exp-1"));
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));

    await act(() => vi.advanceTimersByTimeAsync(10 * 60_000));
    expect(result.current.status).toBe("paused");
    expect(result.current.isPaused).toBe(false);
    const callsWhileIdle = spy.callCount;

    await act(() => vi.advanceTimersByTimeAsync(5 * 60_000));
    expect(spy.callCount).toBe(callsWhileIdle);

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown"));
    });
    expect(result.current.status).toBe("live");
    await waitFor(() => expect(spy.callCount).toBe(callsWhileIdle + 1));
  });

  it("says it is behind after two minutes without a successful refresh", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    server.mount(contract.experiments.getExperimentTables, { body: [RAW] });

    const { result } = renderHook(() => useExperimentDataFreshness("exp-1"));
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));

    server.mount(contract.experiments.getExperimentTables, { status: 500 });
    await act(() => vi.advanceTimersByTimeAsync(2 * 60_000 + 1_000));

    await waitFor(() => expect(result.current.status).toBe("behind"));
  });
});
