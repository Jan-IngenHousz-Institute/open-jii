import { orpc } from "@/lib/orpc";
import { createExperimentTable } from "@/test/factories";
import { server } from "@/test/msw/server";
import { act, createTestQueryClient, renderHook, waitFor } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { useExperimentDataFreshness } from "./useExperimentDataFreshness";

const RAW = createExperimentTable({
  identifier: "raw_data",
  totalRows: 10,
  latestRowAt: "2026-09-22T10:05:00.000Z",
});
const MACRO = createExperimentTable({
  identifier: "macro-1",
  tableType: "macro",
  totalRows: 4,
  latestRowAt: "2026-09-22T10:07:00.000Z",
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

  it("holds the rows still while paused and applies what moved on resume", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryDefaults(orpc.experiments.getExperimentData.key(), { gcTime: Infinity });
    queryClient.setQueryData(dataKey("raw_data"), []);
    const moved = { ...RAW, totalRows: 11 };
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

    act(() => result.current.togglePaused());

    await waitFor(() =>
      expect(queryClient.getQueryState(dataKey("raw_data"))?.isInvalidated).toBe(true),
    );
  });

  it("reports the asked table's newest row, or the experiment's without one", async () => {
    server.mount(contract.experiments.getExperimentTables, { body: [RAW, MACRO] });

    const { result: table } = renderHook(() => useExperimentDataFreshness("exp-1", "raw_data"));
    const { result: experiment } = renderHook(() => useExperimentDataFreshness("exp-1"));

    await waitFor(() => expect(table.current.newestRowAt).toBe("2026-09-22T10:05:00.000Z"));
    await waitFor(() => expect(experiment.current.newestRowAt).toBe("2026-09-22T10:07:00.000Z"));
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
