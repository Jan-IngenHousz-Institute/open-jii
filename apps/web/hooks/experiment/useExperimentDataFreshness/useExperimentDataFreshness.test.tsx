import { orpc } from "@/lib/orpc";
import { createExperimentTable } from "@/test/factories";
import { API_URL } from "@/test/msw/mount";
import { server } from "@/test/msw/server";
import { act, createTestQueryClient, renderHook, waitFor } from "@/test/test-utils";
import { focusManager, useQuery } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { ExperimentTablesEvent } from "@repo/api/domains/experiment/data/experiment-data.schema";

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

const RAW_VERSION = {
  identifier: RAW.identifier,
  totalRows: RAW.totalRows,
  latestRowAt: RAW.latestRowAt,
  schemaRevision: RAW.schemaRevision,
};

/** The store's change stream, held open until a test sends on it, ends it or drops it. */
function mountChangeStream() {
  const encoder = new TextEncoder();
  const streams: ReadableStreamDefaultController<Uint8Array>[] = [];
  const closed = new Set<ReadableStreamDefaultController<Uint8Array>>();
  server.use(
    http.get(`${API_URL}/api/v1/experiments/:id/tables/changes`, ({ request }) => {
      let stream: ReadableStreamDefaultController<Uint8Array> | undefined;
      const markClosed = () => {
        if (stream) {
          closed.add(stream);
        }
      };
      // The client's abort reaches the handler's signal or cancels the body, whichever comes first.
      request.signal.addEventListener("abort", markClosed);
      const body = new ReadableStream<Uint8Array>({
        start: (controller) => {
          stream = controller;
          streams.push(controller);
        },
        cancel: markClosed,
      });
      return new HttpResponse(body, { headers: { "content-type": "text/event-stream" } });
    }),
  );

  return {
    opened: () => streams.length,
    closed: () => closed.size,
    send: async (event: ExperimentTablesEvent) => {
      streams.at(-1)?.enqueue(encoder.encode(`event: message\ndata: ${JSON.stringify(event)}\n\n`));
      await vi.advanceTimersByTimeAsync(10);
    },
    drop: async () => {
      streams.at(-1)?.error(new Error("connection lost"));
      await vi.advanceTimersByTimeAsync(10);
    },
    end: async () => {
      streams.at(-1)?.close();
      await vi.advanceTimersByTimeAsync(10);
    },
  };
}

function dataKey(tableName: string) {
  return orpc.experiments.getExperimentData.queryKey({
    input: { id: "exp-1", tableName, page: 1, pageSize: 10 },
  });
}

function columnsKey(tableName: string) {
  return orpc.experiments.getExperimentTableColumns.queryKey({
    input: { id: "exp-1", tableName },
  });
}

describe("useExperimentDataFreshness", () => {
  it("invalidates joined reads and metadata when the secondary schema changes", async () => {
    const queryClient = createTestQueryClient();
    const join = JSON.stringify({
      tableName: "macro-1",
      matchColumn: "station",
      primaryTimeColumn: "timestamp",
      secondaryTimeColumn: "timestamp",
      toleranceMinutes: 5,
    });
    const rows = orpc.experiments.getExperimentData.queryKey({
      input: { id: "exp-1", tableName: "raw_data", join },
    });
    const columns = orpc.experiments.getExperimentTableColumns.queryKey({
      input: { id: "exp-1", tableName: "raw_data", join },
    });
    for (const key of [rows, columns]) {
      queryClient.setQueryDefaults(key, {
        gcTime: Infinity,
        meta: { secondaryTableName: "macro-1" },
      });
      queryClient.setQueryData(key, []);
    }
    const spy = server.mount(contract.experiments.getExperimentTables, {
      body: () => [RAW, spy.callCount > 1 ? { ...MACRO, schemaRevision: "schema-2" } : MACRO],
    });
    const { result } = renderHook(() => useExperimentDataFreshness("exp-1", "warehouse"), {
      queryClient,
    });
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    await act(() =>
      queryClient.refetchQueries({ queryKey: orpc.experiments.getExperimentTables.key() }),
    );
    await waitFor(() => expect(queryClient.getQueryState(rows)?.isInvalidated).toBe(true));
    expect(queryClient.getQueryState(columns)?.isInvalidated).toBe(true);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("refetches only the tables whose count or newest row moved, and leaves their columns", async () => {
    const queryClient = createTestQueryClient();
    // Nothing observes the seeded reads, so keep them past the test client's gcTime of 0.
    queryClient.setQueryDefaults(orpc.experiments.getExperimentData.key(), { gcTime: Infinity });
    queryClient.setQueryDefaults(orpc.experiments.getExperimentTableColumns.key(), {
      gcTime: Infinity,
    });
    queryClient.setQueryData(dataKey("raw_data"), []);
    queryClient.setQueryData(dataKey("macro-1"), []);
    queryClient.setQueryData(columnsKey("raw_data"), { columns: [] });
    const moved = { ...RAW, totalRows: 11, latestRowAt: "2026-09-22T10:08:00.000Z" };
    const spy = server.mount(contract.experiments.getExperimentTables, {
      body: () => (spy.callCount > 1 ? [moved, MACRO] : [RAW, MACRO]),
    });

    const { result } = renderHook(() => useExperimentDataFreshness("exp-1", "warehouse"), {
      queryClient,
    });
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));

    await act(() =>
      queryClient.refetchQueries({ queryKey: orpc.experiments.getExperimentTables.key() }),
    );

    await waitFor(() =>
      expect(queryClient.getQueryState(dataKey("raw_data"))?.isInvalidated).toBe(true),
    );
    expect(queryClient.getQueryState(dataKey("macro-1"))?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(columnsKey("raw_data"))?.isInvalidated).toBe(false);
  });

  it("refetches a table and its columns when its schema changed after its rows did", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryDefaults(orpc.experiments.getExperimentData.key(), { gcTime: Infinity });
    queryClient.setQueryDefaults(orpc.experiments.getExperimentTableColumns.key(), {
      gcTime: Infinity,
    });
    queryClient.setQueryData(dataKey("raw_data"), []);
    queryClient.setQueryData(columnsKey("raw_data"), { columns: [] });
    const widened = { ...RAW, schemaRevision: "schema-2" };
    const spy = server.mount(contract.experiments.getExperimentTables, {
      body: () => (spy.callCount > 1 ? [widened] : [RAW]),
    });

    const { result } = renderHook(() => useExperimentDataFreshness("exp-1", "warehouse"), {
      queryClient,
    });
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));

    await act(() =>
      queryClient.refetchQueries({ queryKey: orpc.experiments.getExperimentTables.key() }),
    );

    await waitFor(() =>
      expect(queryClient.getQueryState(dataKey("raw_data"))?.isInvalidated).toBe(true),
    );
    expect(queryClient.getQueryState(columnsKey("raw_data"))?.isInvalidated).toBe(true);
  });

  it("retries rows whose refresh failed on the next poll, though nothing moved", async () => {
    const queryClient = createTestQueryClient();
    server.mount(contract.experiments.getExperimentTables, { body: [RAW] });
    server.mount(contract.experiments.getExperimentData, { status: 500 });

    const { result } = renderHook(
      () => {
        const freshness = useExperimentDataFreshness("exp-1", "warehouse");
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

    const { result } = renderHook(() => useExperimentDataFreshness("exp-1", "warehouse"), {
      queryClient,
    });
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

    const { result: one } = renderHook(() =>
      useExperimentDataFreshness("exp-1", "warehouse", ["raw_data"]),
    );
    const { result: two } = renderHook(() =>
      useExperimentDataFreshness("exp-1", "warehouse", ["raw_data", "macro-1"]),
    );
    const { result: experiment } = renderHook(() =>
      useExperimentDataFreshness("exp-1", "warehouse"),
    );

    await waitFor(() => expect(one.current.newestRowAt).toBe("2026-09-22T10:05:00.000Z"));
    await waitFor(() => expect(two.current.newestRowAt).toBe("2026-09-22T10:07:00.000Z"));
    await waitFor(() => expect(experiment.current.newestRowAt).toBe("2026-09-22T10:09:00.000Z"));
  });

  it("reports no newest row for an experiment without rows", async () => {
    server.mount(contract.experiments.getExperimentTables, { body: [] });

    const { result } = renderHook(() => useExperimentDataFreshness("exp-1", "warehouse"));

    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    expect(result.current.newestRowAt).toBeNull();
    expect(result.current.status).toBe("live");
  });

  it("stops checking while paused, and catches up at once on resume", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const spy = server.mount(contract.experiments.getExperimentTables, { body: [RAW] });

    const { result } = renderHook(() => useExperimentDataFreshness("exp-1", "warehouse"));
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));

    act(() => result.current.togglePaused());
    expect(result.current.status).toBe("paused");
    const callsWhilePaused = spy.callCount;

    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(spy.callCount).toBe(callsWhilePaused);

    act(() => result.current.togglePaused());
    expect(result.current.status).toBe("live");
    await waitFor(() => expect(spy.callCount).toBe(callsWhilePaused + 1));
  });

  it("stops polling after ten idle minutes and catches up on the next input", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const spy = server.mount(contract.experiments.getExperimentTables, { body: [RAW] });

    const { result } = renderHook(() => useExperimentDataFreshness("exp-1", "warehouse"));
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

  describe("with rows from the store", () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      // The reconnect wait is then exactly its base: ten seconds, doubling.
      vi.spyOn(Math, "random").mockReturnValue(0.5);
    });

    afterEach(() => {
      focusManager.setFocused(undefined);
      vi.restoreAllMocks();
    });

    async function goLive(stream: ReturnType<typeof mountChangeStream>) {
      await waitFor(() => expect(stream.opened()).toBe(1));
      await act(() => stream.send({ type: "changed", tables: [RAW_VERSION] }));
    }

    it("applies a change to the listing it holds, refetching the moved rows but not the listing", async () => {
      const listing = server.mount(contract.experiments.getExperimentTables, { body: [RAW] });
      const rowReads = server.mount(contract.experiments.getExperimentData, { body: [] });
      const stream = mountChangeStream();
      const { result } = renderHook(() => {
        const freshness = useExperimentDataFreshness("exp-1", "store");
        useQuery(
          orpc.experiments.getExperimentData.queryOptions({
            input: { id: "exp-1", tableName: "raw_data", page: 1, pageSize: 10 },
          }),
        );
        return freshness;
      });
      await goLive(stream);
      await waitFor(() => expect(rowReads.callCount).toBe(1));
      const listingCalls = listing.callCount;

      await act(() => vi.advanceTimersByTimeAsync(60_000));
      await act(() =>
        stream.send({
          type: "changed",
          tables: [{ ...RAW_VERSION, totalRows: 11, latestRowAt: "2026-09-22T10:06:00.000Z" }],
        }),
      );

      await waitFor(() => expect(rowReads.callCount).toBe(2));
      expect(result.current.newestRowAt).toBe("2026-09-22T10:06:00.000Z");
      expect(listing.callCount).toBe(listingCalls);
    });

    it("fetches the listing once for a change that names a new table", async () => {
      const listing = server.mount(contract.experiments.getExperimentTables, { body: [RAW] });
      const stream = mountChangeStream();
      renderHook(() => useExperimentDataFreshness("exp-1", "store"));
      await goLive(stream);
      const listingCalls = listing.callCount;

      await act(() =>
        stream.send({
          type: "changed",
          tables: [RAW_VERSION, { ...RAW_VERSION, identifier: "macro-1" }],
        }),
      );

      await waitFor(() => expect(listing.callCount).toBe(listingCalls + 1));
    });

    it("retries rows whose refresh failed at a heartbeat, though nothing moved", async () => {
      const listing = server.mount(contract.experiments.getExperimentTables, { body: [RAW] });
      server.mount(contract.experiments.getExperimentData, { status: 500 });
      const stream = mountChangeStream();
      const { result } = renderHook(() => {
        useExperimentDataFreshness("exp-1", "store");
        return useQuery(
          orpc.experiments.getExperimentData.queryOptions({
            input: { id: "exp-1", tableName: "raw_data", page: 1, pageSize: 10 },
          }),
        );
      });
      await goLive(stream);
      await waitFor(() => expect(result.current.isError).toBe(true));
      const listingCalls = listing.callCount;

      const rowReads = server.mount(contract.experiments.getExperimentData, { body: [] });
      await act(() => stream.send({ type: "heartbeat" }));

      await waitFor(() => expect(rowReads.callCount).toBe(1));
      expect(listing.callCount).toBe(listingCalls);
    });

    it("counts a heartbeat as current, so a quiet stream is not behind", async () => {
      server.mount(contract.experiments.getExperimentTables, { body: [RAW] });
      const stream = mountChangeStream();
      const { result } = renderHook(() => useExperimentDataFreshness("exp-1", "store"));
      await goLive(stream);

      for (let beat = 0; beat < 7; beat++) {
        await act(() => vi.advanceTimersByTimeAsync(20_000));
        await act(() => stream.send({ type: "heartbeat" }));
      }

      expect(result.current.status).toBe("live");
    });

    it("stays live when the stream drops, and is behind two minutes after it last heard", async () => {
      server.mount(contract.experiments.getExperimentTables, { body: [RAW] });
      const stream = mountChangeStream();
      const { result } = renderHook(() => useExperimentDataFreshness("exp-1", "store"));
      await goLive(stream);
      for (let beat = 0; beat < 15; beat++) {
        await act(() => vi.advanceTimersByTimeAsync(20_000));
        await act(() => stream.send({ type: "heartbeat" }));
      }

      server.mount(contract.experiments.getExperimentTables, { status: 500 });
      server.mount(contract.experiments.watchExperimentTables, { status: 500 });
      await act(() => stream.drop());
      await act(() => vi.advanceTimersByTimeAsync(1_000));
      expect(result.current.status).toBe("live");

      await act(() => vi.advanceTimersByTimeAsync(2 * 60_000));
      await waitFor(() => expect(result.current.status).toBe("behind"));
    });

    it("polls every 30 s while the stream is down, and reconnects after a growing wait", async () => {
      const listing = server.mount(contract.experiments.getExperimentTables, { body: [RAW] });
      const stream = mountChangeStream();
      renderHook(() => useExperimentDataFreshness("exp-1", "store"));
      await goLive(stream);
      const listingCalls = listing.callCount;

      const reopens = server.mount(contract.experiments.watchExperimentTables, { status: 500 });
      await act(() => stream.drop());
      await act(() => vi.advanceTimersByTimeAsync(9_900));
      expect(reopens.callCount).toBe(0);
      await act(() => vi.advanceTimersByTimeAsync(100));
      await waitFor(() => expect(reopens.callCount).toBe(1));

      await act(() => vi.advanceTimersByTimeAsync(19_800));
      expect(reopens.callCount).toBe(1);
      await act(() => vi.advanceTimersByTimeAsync(200));
      await waitFor(() => expect(reopens.callCount).toBe(2));
      await waitFor(() => expect(listing.callCount).toBe(listingCalls + 1));
    });

    it("reconnects after a stream ends at its lifetime", async () => {
      server.mount(contract.experiments.getExperimentTables, { body: [RAW] });
      const stream = mountChangeStream();
      renderHook(() => useExperimentDataFreshness("exp-1", "store"));
      await goLive(stream);

      await act(() => stream.end());
      await act(() => vi.advanceTimersByTimeAsync(9_900));
      expect(stream.opened()).toBe(1);
      await act(() => vi.advanceTimersByTimeAsync(100));

      await waitFor(() => expect(stream.opened()).toBe(2));
    });

    it.each([403, 404, 429])(
      "polls instead of reconnecting when the stream is refused with %i",
      async (status) => {
        const listing = server.mount(contract.experiments.getExperimentTables, { body: [RAW] });
        const opens = server.mount(contract.experiments.watchExperimentTables, { status });
        const { result } = renderHook(() => useExperimentDataFreshness("exp-1", "store"));
        await waitFor(() => expect(result.current.hasLoaded).toBe(true));
        await waitFor(() => expect(opens.callCount).toBe(1));
        const listingCalls = listing.callCount;

        await act(() => vi.advanceTimersByTimeAsync(60_000));

        expect(opens.callCount).toBe(1);
        await waitFor(() => expect(listing.callCount).toBe(listingCalls + 2));
      },
    );

    it("closes the stream in a hidden tab, and reopens it with at most one fetch when shown", async () => {
      const listing = server.mount(contract.experiments.getExperimentTables, { body: [RAW] });
      const stream = mountChangeStream();
      renderHook(() => useExperimentDataFreshness("exp-1", "store"));
      await goLive(stream);

      act(() => focusManager.setFocused(false));
      await waitFor(() => expect(stream.closed()).toBe(1));
      const callsWhileHidden = listing.callCount;
      await act(() => vi.advanceTimersByTimeAsync(5 * 60_000));
      expect(listing.callCount).toBe(callsWhileHidden);

      act(() => focusManager.setFocused(true));
      await waitFor(() => expect(stream.opened()).toBe(2));
      await act(() => stream.send({ type: "changed", tables: [RAW_VERSION] }));
      await act(() => vi.advanceTimersByTimeAsync(1_000));

      expect(listing.callCount).toBeLessThanOrEqual(callsWhileHidden + 1);
    });

    it("closes the stream while paused, and reopens it with one fetch on resume", async () => {
      const listing = server.mount(contract.experiments.getExperimentTables, { body: [RAW] });
      const stream = mountChangeStream();
      const { result } = renderHook(() => useExperimentDataFreshness("exp-1", "store"));
      await goLive(stream);

      act(() => result.current.togglePaused());
      await waitFor(() => expect(stream.closed()).toBe(1));
      const callsWhilePaused = listing.callCount;

      act(() => result.current.togglePaused());
      await waitFor(() => expect(stream.opened()).toBe(2));
      await act(() => stream.send({ type: "changed", tables: [RAW_VERSION] }));
      await act(() => vi.advanceTimersByTimeAsync(1_000));

      expect(listing.callCount).toBe(callsWhilePaused + 1);
    });

    it("closes the stream after ten idle minutes, and reopens it with one fetch on input", async () => {
      const listing = server.mount(contract.experiments.getExperimentTables, { body: [RAW] });
      const stream = mountChangeStream();
      const { result } = renderHook(() => useExperimentDataFreshness("exp-1", "store"));
      await goLive(stream);

      await act(() => vi.advanceTimersByTimeAsync(10 * 60_000));
      expect(result.current.status).toBe("paused");
      await waitFor(() => expect(stream.closed()).toBe(1));
      const callsWhileIdle = listing.callCount;

      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown"));
      });
      await waitFor(() => expect(stream.opened()).toBe(2));
      await act(() => stream.send({ type: "changed", tables: [RAW_VERSION] }));
      await act(() => vi.advanceTimersByTimeAsync(1_000));

      expect(listing.callCount).toBe(callsWhileIdle + 1);
    });

    it("opens the stream when the rows' source turns to the store, and closes it when it turns back", async () => {
      server.mount(contract.experiments.getExperimentTables, { body: [RAW] });
      const stream = mountChangeStream();

      const { rerender } = renderHook(
        ({ source }: { source: "warehouse" | "store" }) =>
          useExperimentDataFreshness("exp-1", source),
        { initialProps: { source: "warehouse" } },
      );
      expect(stream.opened()).toBe(0);

      rerender({ source: "store" });
      await waitFor(() => expect(stream.opened()).toBe(1));

      rerender({ source: "warehouse" });
      await waitFor(() => expect(stream.closed()).toBe(1));
    });
  });

  it("polls a surface whose rows come from the warehouse every 30 s, with no stream", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const listing = server.mount(contract.experiments.getExperimentTables, {
      body: [RAW],
      headers: { "x-data-source": "store" },
    });
    const stream = mountChangeStream();

    const { result } = renderHook(() => useExperimentDataFreshness("exp-1", "warehouse"));
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));
    const callsAfterLoad = listing.callCount;

    await act(() => vi.advanceTimersByTimeAsync(29_000));
    expect(listing.callCount).toBe(callsAfterLoad);
    await act(() => vi.advanceTimersByTimeAsync(1_000));
    await waitFor(() => expect(listing.callCount).toBe(callsAfterLoad + 1));
    expect(stream.opened()).toBe(0);
  });

  it("says it is behind after two minutes without a successful refresh", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    server.mount(contract.experiments.getExperimentTables, { body: [RAW] });

    const { result } = renderHook(() => useExperimentDataFreshness("exp-1", "warehouse"));
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));

    server.mount(contract.experiments.getExperimentTables, { status: 500 });
    await act(() => vi.advanceTimersByTimeAsync(2 * 60_000 + 1_000));

    await waitFor(() => expect(result.current.status).toBe("behind"));
  });
});
