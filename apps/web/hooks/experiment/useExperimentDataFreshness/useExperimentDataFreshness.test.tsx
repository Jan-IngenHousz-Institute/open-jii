import { orpc } from "@/lib/orpc";
import { createExperimentTable } from "@/test/factories";
import type { SpyCall } from "@/test/msw/mount";
import { server } from "@/test/msw/server";
import { act, createTestQueryClient, renderHook, waitFor } from "@/test/test-utils";
import { focusManager, useQuery } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type {
  ExperimentTableMetadata,
  ExperimentTablesEvent,
} from "@repo/api/domains/experiment/data/experiment-data.schema";

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

// Fake time also moves with real time in the stream tests, so a check that nothing happened yet
// stops this far before the deadline, more than a test run can drift.
const BEFORE_DEADLINE_MS = 1_000;

const RAW_VERSION = {
  identifier: RAW.identifier,
  displayName: null,
  totalRows: RAW.totalRows,
  latestRowAt: RAW.latestRowAt,
  schemaRevision: RAW.schemaRevision,
};

/** The store's change stream, held open until a test sends on it, ends it or drops it. */
function mountChangeStream() {
  const encoder = new TextEncoder();
  const streams: ReadableStreamDefaultController<Uint8Array>[] = [];
  const closed = new Set<ReadableStreamDefaultController<Uint8Array>>();
  server.mount(contract.experiments.watchExperimentTables, {
    body: ({ signal }: SpyCall) => {
      let stream: ReadableStreamDefaultController<Uint8Array> | undefined;
      const markClosed = () => {
        if (stream) {
          closed.add(stream);
        }
      };
      // The client's abort reaches the handler's signal or cancels the body, whichever comes first.
      // A browser then fails the body's reads, which the mock does not, so the abort fails them.
      signal.addEventListener("abort", () => {
        markClosed();
        stream?.error(signal.reason);
      });
      return new ReadableStream<Uint8Array>({
        start: (controller) => {
          stream = controller;
          streams.push(controller);
        },
        cancel: markClosed,
      });
    },
  });

  return {
    opened: () => streams.length,
    closed: () => closed.size,
    send: async (event: ExperimentTablesEvent) => {
      const current = streams.at(-1);
      if (current && !closed.has(current)) {
        current.enqueue(encoder.encode(`event: message\ndata: ${JSON.stringify(event)}\n\n`));
      }
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

function mountStoreListing(body: ExperimentTableMetadata[]) {
  return server.mount(contract.experiments.getExperimentTables, {
    body,
    headers: { "x-data-source": "store" },
  });
}

/** A store listing that answers only once released, so a test can act while the read is under way. */
function mountHeldStoreListing(body: ExperimentTableMetadata[]) {
  let release: () => void = () => undefined;
  const unblock = new Promise<void>((resolve) => {
    release = resolve;
  });
  const spy = server.mount(contract.experiments.getExperimentTables, {
    body,
    headers: { "x-data-source": "store" },
    unblock,
  });
  return { spy, release: () => release() };
}

function listingKey() {
  return orpc.experiments.getExperimentTables.queryKey({ input: { id: "exp-1" } });
}

function listedTables(queryClient: QueryClient) {
  return queryClient
    .getQueryData(listingKey())
    ?.body.map(({ identifier, totalRows }) => ({ identifier, totalRows }));
}

function isReadingListing(queryClient: QueryClient) {
  return queryClient.getQueryState(listingKey())?.fetchStatus === "fetching";
}

function readListing(queryClient: QueryClient) {
  act(() => {
    void queryClient.refetchQueries({ queryKey: listingKey(), exact: true });
  });
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
    const { result } = renderHook(() => useExperimentDataFreshness("exp-1"), {
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

    const { result } = renderHook(() => useExperimentDataFreshness("exp-1"), {
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

    const { result } = renderHook(() => useExperimentDataFreshness("exp-1"), {
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

    const { result } = renderHook(() => useExperimentDataFreshness("exp-1"), {
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

  it("stops checking while paused, and catches up at once on resume", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const spy = server.mount(contract.experiments.getExperimentTables, { body: [RAW] });

    const { result } = renderHook(() => useExperimentDataFreshness("exp-1"));
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

  describe("with a listing the store answered", () => {
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

    /** Lets time pass on an open stream, which the backend keeps alive with heartbeats. */
    async function beat(stream: ReturnType<typeof mountChangeStream>, times: number) {
      for (let beat = 0; beat < times; beat++) {
        await act(() => vi.advanceTimersByTimeAsync(20_000));
        await act(() => stream.send({ type: "heartbeat" }));
      }
    }

    it("applies a change to the listing it holds, refetching the moved rows but not the listing", async () => {
      const listing = mountStoreListing([RAW]);
      const rowReads = server.mount(contract.experiments.getExperimentData, { body: [] });
      const stream = mountChangeStream();
      const { result } = renderHook(() => {
        const freshness = useExperimentDataFreshness("exp-1");
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

      await beat(stream, 3);
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

    it("refetches a table's rows when only its content revision moves, as rows replaced in place do", async () => {
      mountStoreListing([{ ...RAW, contentRevision: "arrived-1" }]);
      const rowReads = server.mount(contract.experiments.getExperimentData, { body: [] });
      const stream = mountChangeStream();
      renderHook(() => {
        useExperimentDataFreshness("exp-1");
        useQuery(
          orpc.experiments.getExperimentData.queryOptions({
            input: { id: "exp-1", tableName: "raw_data", page: 1, pageSize: 10 },
          }),
        );
      });
      await waitFor(() => expect(stream.opened()).toBe(1));
      await waitFor(() => expect(rowReads.callCount).toBe(1));
      await act(() =>
        stream.send({
          type: "changed",
          tables: [{ ...RAW_VERSION, contentRevision: "arrived-1" }],
        }),
      );
      await act(() => vi.advanceTimersByTimeAsync(1_000));
      expect(rowReads.callCount).toBe(1);

      await act(() =>
        stream.send({
          type: "changed",
          tables: [{ ...RAW_VERSION, contentRevision: "arrived-2" }],
        }),
      );

      await waitFor(() => expect(rowReads.callCount).toBe(2));
    });

    it("refetches a table's rows at most once every 5 s, and the last change of a burst at its end", async () => {
      mountStoreListing([RAW]);
      const rowReads = server.mount(contract.experiments.getExperimentData, { body: [] });
      const columnReads = server.mount(contract.experiments.getExperimentTableColumns, {
        body: { columns: [] },
      });
      const stream = mountChangeStream();
      renderHook(() => {
        useExperimentDataFreshness("exp-1");
        useQuery(
          orpc.experiments.getExperimentData.queryOptions({
            input: { id: "exp-1", tableName: "raw_data", page: 1, pageSize: 10 },
          }),
        );
        useQuery(
          orpc.experiments.getExperimentTableColumns.queryOptions({
            input: { id: "exp-1", tableName: "raw_data" },
          }),
        );
      });
      await goLive(stream);
      await waitFor(() => expect(rowReads.callCount).toBe(1));
      await waitFor(() => expect(columnReads.callCount).toBe(1));

      await act(() =>
        stream.send({ type: "changed", tables: [{ ...RAW_VERSION, totalRows: 11 }] }),
      );
      await waitFor(() => expect(rowReads.callCount).toBe(2));
      await act(() =>
        stream.send({ type: "changed", tables: [{ ...RAW_VERSION, totalRows: 12 }] }),
      );
      // Only the burst's last change moves the schema, so a columns read shows it was the one refreshed.
      await act(() =>
        stream.send({
          type: "changed",
          tables: [{ ...RAW_VERSION, totalRows: 13, schemaRevision: "schema-2" }],
        }),
      );
      await act(() => vi.advanceTimersByTimeAsync(5_000 - BEFORE_DEADLINE_MS));
      expect(rowReads.callCount).toBe(2);

      await act(() => vi.advanceTimersByTimeAsync(BEFORE_DEADLINE_MS));
      await waitFor(() => expect(rowReads.callCount).toBe(3));
      await waitFor(() => expect(columnReads.callCount).toBe(2));
      await act(() => vi.advanceTimersByTimeAsync(10_000));
      expect(rowReads.callCount).toBe(3);
      expect(columnReads.callCount).toBe(2);
    });

    it("lets a rows read under way finish when a change arrives, then reads the newest version once", async () => {
      mountStoreListing([RAW]);
      const firstReads = server.mount(contract.experiments.getExperimentData, { body: [] });
      const stream = mountChangeStream();
      renderHook(() => {
        useExperimentDataFreshness("exp-1");
        useQuery(
          orpc.experiments.getExperimentData.queryOptions({
            input: { id: "exp-1", tableName: "raw_data", page: 1, pageSize: 10 },
          }),
        );
      });
      await goLive(stream);
      await waitFor(() => expect(firstReads.callCount).toBe(1));

      let release: () => void = () => undefined;
      const slowRead = server.mount(contract.experiments.getExperimentData, {
        body: [],
        unblock: new Promise<void>((resolve) => {
          release = resolve;
        }),
      });
      await act(() =>
        stream.send({ type: "changed", tables: [{ ...RAW_VERSION, totalRows: 11 }] }),
      );
      await waitFor(() => expect(slowRead.callCount).toBe(1));
      await act(() =>
        stream.send({ type: "changed", tables: [{ ...RAW_VERSION, totalRows: 12 }] }),
      );
      const followUps = server.mount(contract.experiments.getExperimentData, { body: [] });
      await beat(stream, 1);
      expect(followUps.callCount).toBe(0);

      act(() => release());
      await beat(stream, 1);
      await waitFor(() => expect(followUps.callCount).toBe(1));
      await beat(stream, 1);

      expect(followUps.callCount).toBe(1);
      expect(slowRead.calls.at(0)?.signal.aborted).toBe(false);
    });

    it("refreshes a table whose read ended while another table's read is still under way", async () => {
      const macroVersion = {
        identifier: MACRO.identifier,
        displayName: null,
        totalRows: MACRO.totalRows,
        latestRowAt: MACRO.latestRowAt,
        schemaRevision: MACRO.schemaRevision,
      };
      mountStoreListing([RAW, MACRO]);
      server.mount(contract.experiments.getExperimentData, { body: [] });
      const stream = mountChangeStream();
      renderHook(() => {
        useExperimentDataFreshness("exp-1");
        useQuery(
          orpc.experiments.getExperimentData.queryOptions({
            input: { id: "exp-1", tableName: "raw_data", page: 1, pageSize: 10 },
          }),
        );
        useQuery(
          orpc.experiments.getExperimentData.queryOptions({
            input: { id: "exp-1", tableName: "macro-1", page: 1, pageSize: 10 },
          }),
        );
      });
      await waitFor(() => expect(stream.opened()).toBe(1));
      await act(() => stream.send({ type: "changed", tables: [RAW_VERSION, macroVersion] }));

      const macroRead = server.mount(contract.experiments.getExperimentData, {
        body: [],
        unblock: new Promise<void>(() => undefined),
      });
      await act(() =>
        stream.send({ type: "changed", tables: [RAW_VERSION, { ...macroVersion, totalRows: 5 }] }),
      );
      await waitFor(() => expect(macroRead.callCount).toBe(1));

      let releaseRaw: () => void = () => undefined;
      const rawRead = server.mount(contract.experiments.getExperimentData, {
        body: [],
        unblock: new Promise<void>((resolve) => {
          releaseRaw = resolve;
        }),
      });
      const moved = { ...macroVersion, totalRows: 5 };
      await act(() =>
        stream.send({ type: "changed", tables: [{ ...RAW_VERSION, totalRows: 11 }, moved] }),
      );
      await waitFor(() => expect(rawRead.callCount).toBe(1));
      // Past the gap, so no held refresh runs once the read ends; only the end of the read can.
      await act(() => vi.advanceTimersByTimeAsync(6_000));
      await act(() =>
        stream.send({ type: "changed", tables: [{ ...RAW_VERSION, totalRows: 12 }, moved] }),
      );
      const followUps = server.mount(contract.experiments.getExperimentData, { body: [] });

      act(() => releaseRaw());
      await act(() => vi.advanceTimersByTimeAsync(1_000));

      await waitFor(() =>
        expect(followUps.calls.map(({ query }) => query.tableName)).toEqual(["raw_data"]),
      );
    });

    it("fetches the listing once for a change that names a new table", async () => {
      const listing = mountStoreListing([RAW]);
      const stream = mountChangeStream();
      renderHook(() => useExperimentDataFreshness("exp-1"));
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

    it("keeps a change that arrives during a listing read over the older listing it returns", async () => {
      const queryClient = createTestQueryClient();
      mountStoreListing([RAW]);
      const stream = mountChangeStream();
      renderHook(() => useExperimentDataFreshness("exp-1"), { queryClient });
      await goLive(stream);
      await waitFor(() => expect(isReadingListing(queryClient)).toBe(false));

      const read = mountHeldStoreListing([RAW]);
      readListing(queryClient);
      await waitFor(() => expect(read.spy.callCount).toBe(1));
      await act(() =>
        stream.send({ type: "changed", tables: [{ ...RAW_VERSION, totalRows: 11 }] }),
      );
      read.release();

      await waitFor(() => expect(isReadingListing(queryClient)).toBe(false));
      expect(listedTables(queryClient)).toEqual([{ identifier: "raw_data", totalRows: 11 }]);
    });

    it("leaves a store change out of a listing the warehouse answered while it was pending", async () => {
      const queryClient = createTestQueryClient();
      mountStoreListing([RAW]);
      const stream = mountChangeStream();
      renderHook(() => useExperimentDataFreshness("exp-1"), { queryClient });
      await goLive(stream);
      await waitFor(() => expect(isReadingListing(queryClient)).toBe(false));

      let release: () => void = () => undefined;
      const read = server.mount(contract.experiments.getExperimentTables, {
        body: [RAW],
        headers: { "x-data-source": "warehouse" },
        unblock: new Promise<void>((resolve) => {
          release = resolve;
        }),
      });
      readListing(queryClient);
      await waitFor(() => expect(read.callCount).toBe(1));
      await act(() =>
        stream.send({ type: "changed", tables: [{ ...RAW_VERSION, totalRows: 11 }] }),
      );
      release();

      await waitFor(() => expect(isReadingListing(queryClient)).toBe(false));
      expect(queryClient.getQueryData(listingKey())?.headers["x-data-source"]).toBe("warehouse");
      expect(listedTables(queryClient)).toEqual([{ identifier: "raw_data", totalRows: 10 }]);
    });

    it("leaves out a change that arrives after the page stopped listening", async () => {
      const queryClient = createTestQueryClient();
      mountStoreListing([RAW]);
      const stream = mountChangeStream();
      const { result } = renderHook(() => useExperimentDataFreshness("exp-1"), { queryClient });
      await goLive(stream);
      await waitFor(() => expect(isReadingListing(queryClient)).toBe(false));

      act(() => {
        void stream.send({ type: "changed", tables: [{ ...RAW_VERSION, totalRows: 11 }] });
        result.current.togglePaused();
      });
      await act(() => vi.advanceTimersByTimeAsync(1_000));

      expect(listedTables(queryClient)).toEqual([{ identifier: "raw_data", totalRows: 10 }]);
    });

    it("reads the listing again for a new table whose change joined a read that predates it", async () => {
      const queryClient = createTestQueryClient();
      mountStoreListing([RAW]);
      const stream = mountChangeStream();
      renderHook(() => useExperimentDataFreshness("exp-1"), { queryClient });
      await goLive(stream);
      await waitFor(() => expect(isReadingListing(queryClient)).toBe(false));

      const read = mountHeldStoreListing([RAW]);
      readListing(queryClient);
      await waitFor(() => expect(read.spy.callCount).toBe(1));
      await act(() =>
        stream.send({
          type: "changed",
          tables: [RAW_VERSION, { ...RAW_VERSION, identifier: "macro-1" }],
        }),
      );
      const listing = mountStoreListing([RAW, MACRO]);
      read.release();

      await waitFor(() =>
        expect(listedTables(queryClient)).toEqual([
          { identifier: "raw_data", totalRows: 10 },
          { identifier: "macro-1", totalRows: 10 },
        ]),
      );
      expect(listing.callCount).toBe(1);
    });

    it("reads the listing again when an upload comes in under a new name", async () => {
      const queryClient = createTestQueryClient();
      const upload = createExperimentTable({
        identifier: "upload-1",
        tableType: "upload",
        displayName: "Soil cores",
        totalRows: 5,
      });
      const uploadVersion = {
        identifier: upload.identifier,
        displayName: upload.displayName,
        totalRows: upload.totalRows,
        latestRowAt: upload.latestRowAt,
        schemaRevision: upload.schemaRevision,
      };
      mountStoreListing([RAW, upload]);
      const stream = mountChangeStream();
      renderHook(() => useExperimentDataFreshness("exp-1"), { queryClient });
      await waitFor(() => expect(stream.opened()).toBe(1));
      await act(() => stream.send({ type: "changed", tables: [RAW_VERSION, uploadVersion] }));
      await waitFor(() => expect(isReadingListing(queryClient)).toBe(false));

      const listing = mountStoreListing([
        RAW,
        { ...upload, displayName: "Soil cores, spring", totalRows: 9 },
      ]);
      await act(() =>
        stream.send({
          type: "changed",
          tables: [
            RAW_VERSION,
            { ...uploadVersion, displayName: "Soil cores, spring", totalRows: 9 },
          ],
        }),
      );

      await waitFor(() => expect(listing.callCount).toBe(1));
      await waitFor(() =>
        expect(
          queryClient.getQueryData(listingKey())?.body.map(({ displayName }) => displayName),
        ).toEqual([RAW.displayName, "Soil cores, spring"]),
      );
    });

    it("retries a failed listing read for a new table at the next heartbeat", async () => {
      const queryClient = createTestQueryClient();
      mountStoreListing([RAW]);
      const stream = mountChangeStream();
      renderHook(() => useExperimentDataFreshness("exp-1"), { queryClient });
      await goLive(stream);
      await waitFor(() => expect(isReadingListing(queryClient)).toBe(false));

      const failed = server.mount(contract.experiments.getExperimentTables, { status: 500 });
      await act(() =>
        stream.send({
          type: "changed",
          tables: [RAW_VERSION, { ...RAW_VERSION, identifier: "macro-1" }],
        }),
      );
      await waitFor(() => expect(failed.callCount).toBe(1));
      await waitFor(() => expect(isReadingListing(queryClient)).toBe(false));
      const listing = mountStoreListing([RAW, MACRO]);

      await act(() => stream.send({ type: "heartbeat" }));

      await waitFor(() => expect(listing.callCount).toBe(1));
      await waitFor(() =>
        expect(listedTables(queryClient)).toEqual([
          { identifier: "raw_data", totalRows: 10 },
          { identifier: "macro-1", totalRows: 10 },
        ]),
      );
    });

    it("retries rows whose refresh failed at a heartbeat, though nothing moved", async () => {
      const listing = mountStoreListing([RAW]);
      const firstReads = server.mount(contract.experiments.getExperimentData, { body: [] });
      const stream = mountChangeStream();
      const { result } = renderHook(() => {
        useExperimentDataFreshness("exp-1");
        return useQuery(
          orpc.experiments.getExperimentData.queryOptions({
            input: { id: "exp-1", tableName: "raw_data", page: 1, pageSize: 10 },
          }),
        );
      });
      await goLive(stream);
      await waitFor(() => expect(firstReads.callCount).toBe(1));
      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const failedReads = server.mount(contract.experiments.getExperimentData, { status: 500 });
      await act(() =>
        stream.send({ type: "changed", tables: [{ ...RAW_VERSION, totalRows: 11 }] }),
      );
      await waitFor(() => expect(failedReads.callCount).toBe(1));
      await waitFor(() => expect(result.current.isError).toBe(true));
      const listingCalls = listing.callCount;

      const rowReads = server.mount(contract.experiments.getExperimentData, { body: [] });
      await act(() => stream.send({ type: "heartbeat" }));

      await waitFor(() => expect(rowReads.callCount).toBe(1));
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(listing.callCount).toBe(listingCalls);
    });

    it("counts a heartbeat as current, so a quiet stream is not behind", async () => {
      const listing = mountStoreListing([RAW]);
      const stream = mountChangeStream();
      const { result } = renderHook(() => useExperimentDataFreshness("exp-1"));
      await goLive(stream);
      await waitFor(() => expect(listing.callCount).toBe(2));
      const heardBefore = result.current.refreshedAt.getTime();

      await beat(stream, 7);

      // The heartbeats, not polls of the listing, kept the page current.
      expect(result.current.status).toBe("live");
      expect(result.current.refreshedAt.getTime()).toBeGreaterThan(heardBefore);
      expect(stream.closed()).toBe(0);
      expect(listing.callCount).toBe(2);
    });

    it("stays live when the stream drops, and is behind two minutes after it last heard", async () => {
      mountStoreListing([RAW]);
      const stream = mountChangeStream();
      const { result } = renderHook(() => useExperimentDataFreshness("exp-1"));
      await goLive(stream);
      await beat(stream, 15);

      server.mount(contract.experiments.getExperimentTables, { status: 500 });
      server.mount(contract.experiments.watchExperimentTables, { status: 500 });
      await act(() => stream.drop());
      await act(() => vi.advanceTimersByTimeAsync(1_000));
      expect(result.current.status).toBe("live");

      await act(() => vi.advanceTimersByTimeAsync(2 * 60_000));
      await waitFor(() => expect(result.current.status).toBe("behind"));
    });

    it("polls every 30 s while the stream is down, and reconnects after a growing wait", async () => {
      const listing = mountStoreListing([RAW]);
      const stream = mountChangeStream();
      renderHook(() => useExperimentDataFreshness("exp-1"));
      await goLive(stream);
      const listingCalls = listing.callCount;

      const reopens = server.mount(contract.experiments.watchExperimentTables, { status: 500 });
      await act(() => stream.drop());
      await act(() => vi.advanceTimersByTimeAsync(10_000 - BEFORE_DEADLINE_MS));
      expect(reopens.callCount).toBe(0);
      await act(() => vi.advanceTimersByTimeAsync(BEFORE_DEADLINE_MS));
      await waitFor(() => expect(reopens.callCount).toBe(1));

      await act(() => vi.advanceTimersByTimeAsync(20_000 - BEFORE_DEADLINE_MS));
      expect(reopens.callCount).toBe(1);
      await act(() => vi.advanceTimersByTimeAsync(BEFORE_DEADLINE_MS));
      await waitFor(() => expect(reopens.callCount).toBe(2));
      await waitFor(() => expect(listing.callCount).toBe(listingCalls + 1));
    });

    it("reconnects after a stream ends at its lifetime", async () => {
      mountStoreListing([RAW]);
      const stream = mountChangeStream();
      renderHook(() => useExperimentDataFreshness("exp-1"));
      await goLive(stream);

      await act(() => stream.end());
      await act(() => vi.advanceTimersByTimeAsync(10_000 - BEFORE_DEADLINE_MS));
      expect(stream.opened()).toBe(1);
      await act(() => vi.advanceTimersByTimeAsync(BEFORE_DEADLINE_MS));

      await waitFor(() => expect(stream.opened()).toBe(2));
    });

    /** Ends the open stream, and checks the next one opens once `waitMs` has passed and not before. */
    async function endAndReopenAfter(stream: ReturnType<typeof mountChangeStream>, waitMs: number) {
      const opened = stream.opened();
      await act(() => stream.end());
      await act(() => vi.advanceTimersByTimeAsync(waitMs - BEFORE_DEADLINE_MS));
      expect(stream.opened()).toBe(opened);
      await act(() => vi.advanceTimersByTimeAsync(BEFORE_DEADLINE_MS));
      await waitFor(() => expect(stream.opened()).toBe(opened + 1));
    }

    it("waits longer after each stream that ends soon after it opens, though each sent a change", async () => {
      mountStoreListing([RAW]);
      const stream = mountChangeStream();
      renderHook(() => useExperimentDataFreshness("exp-1"));
      await goLive(stream);

      await endAndReopenAfter(stream, 10_000);
      await act(() => stream.send({ type: "changed", tables: [RAW_VERSION] }));
      await endAndReopenAfter(stream, 20_000);
      await act(() => stream.send({ type: "changed", tables: [RAW_VERSION] }));
      await endAndReopenAfter(stream, 40_000);
    });

    it("takes its listener off the page's abort signal once a reconnect wait is over", async () => {
      const listing = mountStoreListing([RAW]);
      const stream = mountChangeStream();
      renderHook(() => useExperimentDataFreshness("exp-1"));
      await goLive(stream);
      await waitFor(() => expect(listing.callCount).toBe(2));
      const listen = vi.spyOn(AbortSignal.prototype, "addEventListener");
      const unlisten = vi.spyOn(AbortSignal.prototype, "removeEventListener");

      await act(() => stream.end());
      await act(() => vi.advanceTimersByTimeAsync(1_000));
      const waiting = listen.mock.calls.flatMap(([type, listener]) =>
        type === "abort" ? [listener] : [],
      );
      await act(() => vi.advanceTimersByTimeAsync(9_000));
      await waitFor(() => expect(stream.opened()).toBe(2));

      expect(waiting).not.toHaveLength(0);
      const removed = unlisten.mock.calls.map(([, listener]) => listener);
      expect(removed).toEqual(expect.arrayContaining(waiting));
    });

    it("starts the wait over after a stream that stayed open past the longest wait", async () => {
      mountStoreListing([RAW]);
      const stream = mountChangeStream();
      renderHook(() => useExperimentDataFreshness("exp-1"));
      await goLive(stream);
      await endAndReopenAfter(stream, 10_000);

      await act(() => stream.send({ type: "changed", tables: [RAW_VERSION] }));
      await beat(stream, 6);

      await endAndReopenAfter(stream, 10_000);
    });

    it.each([429, 503])(
      "reconnects after the growing wait when the stream is refused with %i",
      async (status) => {
        mountStoreListing([RAW]);
        const opens = server.mount(contract.experiments.watchExperimentTables, { status });
        renderHook(() => useExperimentDataFreshness("exp-1"));
        await waitFor(() => expect(opens.callCount).toBe(1));

        await act(() => vi.advanceTimersByTimeAsync(10_000 - BEFORE_DEADLINE_MS));
        expect(opens.callCount).toBe(1);
        await act(() => vi.advanceTimersByTimeAsync(BEFORE_DEADLINE_MS));
        await waitFor(() => expect(opens.callCount).toBe(2));

        await act(() => vi.advanceTimersByTimeAsync(20_000 - BEFORE_DEADLINE_MS));
        expect(opens.callCount).toBe(2);
        await act(() => vi.advanceTimersByTimeAsync(BEFORE_DEADLINE_MS));
        await waitFor(() => expect(opens.callCount).toBe(3));
      },
    );

    it("reads the listing on a stream's first change, and not on a later one", async () => {
      const queryClient = createTestQueryClient();
      const listingKey = orpc.experiments.getExperimentTables.queryKey({ input: { id: "exp-1" } });
      queryClient.setQueryDefaults(listingKey, { gcTime: Infinity });
      queryClient.setQueryData(listingKey, { headers: { "x-data-source": "store" }, body: [RAW] });
      await act(() => vi.advanceTimersByTimeAsync(1_000));
      const listing = mountStoreListing([RAW]);
      const stream = mountChangeStream();
      renderHook(() => useExperimentDataFreshness("exp-1"), { queryClient });
      await waitFor(() => expect(stream.opened()).toBe(1));

      await act(() => stream.send({ type: "changed", tables: [RAW_VERSION] }));
      await waitFor(() => expect(listing.callCount).toBe(1));
      await act(() =>
        stream.send({ type: "changed", tables: [{ ...RAW_VERSION, totalRows: 11 }] }),
      );
      await waitFor(() =>
        expect(listedTables(queryClient)).toEqual([{ identifier: "raw_data", totalRows: 11 }]),
      );

      expect(listing.callCount).toBe(1);
    });

    it.each([403, 404])(
      "polls instead of reconnecting when the stream is refused with %i",
      async (status) => {
        const listing = mountStoreListing([RAW]);
        const opens = server.mount(contract.experiments.watchExperimentTables, { status });
        const { result } = renderHook(() => useExperimentDataFreshness("exp-1"));
        await waitFor(() => expect(result.current.hasLoaded).toBe(true));
        await waitFor(() => expect(opens.callCount).toBe(1));
        const listingCalls = listing.callCount;

        await act(() => vi.advanceTimersByTimeAsync(60_000));

        expect(opens.callCount).toBe(1);
        await waitFor(() => expect(listing.callCount).toBe(listingCalls + 2));
      },
    );

    it("closes the stream in a hidden tab, and reopens it with at most one fetch when shown", async () => {
      const listing = mountStoreListing([RAW]);
      const stream = mountChangeStream();
      renderHook(() => useExperimentDataFreshness("exp-1"));
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
      const listing = mountStoreListing([RAW]);
      const stream = mountChangeStream();
      const { result } = renderHook(() => useExperimentDataFreshness("exp-1"));
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
      const listing = mountStoreListing([RAW]);
      const stream = mountChangeStream();
      const { result } = renderHook(() => useExperimentDataFreshness("exp-1"));
      await goLive(stream);

      await beat(stream, 29);
      await act(() => vi.advanceTimersByTimeAsync(30_000));
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

    it("treats a stream silent past two heartbeats as dropped, and polls until it reconnects", async () => {
      const listing = mountStoreListing([RAW]);
      const stream = mountChangeStream();
      renderHook(() => useExperimentDataFreshness("exp-1"));
      await goLive(stream);
      await waitFor(() => expect(listing.callCount).toBe(2));

      await act(() => vi.advanceTimersByTimeAsync(44_000));
      expect(stream.closed()).toBe(0);
      await act(() => vi.advanceTimersByTimeAsync(1_000));
      await waitFor(() => expect(stream.closed()).toBe(1));

      await act(() => vi.advanceTimersByTimeAsync(10_000));
      await waitFor(() => expect(stream.opened()).toBe(2));
      await act(() => vi.advanceTimersByTimeAsync(20_000));
      await waitFor(() => expect(listing.callCount).toBe(3));
    });

    it("opens the stream when the store answers the listing, and closes it when the warehouse does", async () => {
      const warehouse = { "x-data-source": "warehouse" };
      server.mount(contract.experiments.getExperimentTables, { body: [RAW], headers: warehouse });
      const stream = mountChangeStream();
      const { result } = renderHook(() => useExperimentDataFreshness("exp-1"));
      await waitFor(() => expect(result.current.hasLoaded).toBe(true));
      expect(stream.opened()).toBe(0);

      mountStoreListing([RAW]);
      await act(() => vi.advanceTimersByTimeAsync(30_000));
      await waitFor(() => expect(stream.opened()).toBe(1));

      server.mount(contract.experiments.getExperimentTables, { body: [RAW], headers: warehouse });
      await act(() => stream.send({ type: "changed", tables: [RAW_VERSION] }));
      await waitFor(() => expect(stream.closed()).toBe(1));
    });
  });

  it("polls a listing the warehouse answered every 30 s, with no stream", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const listing = server.mount(contract.experiments.getExperimentTables, {
      body: [RAW],
      headers: { "x-data-source": "warehouse" },
    });
    const stream = mountChangeStream();

    const { result } = renderHook(() => useExperimentDataFreshness("exp-1"));
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

    const { result } = renderHook(() => useExperimentDataFreshness("exp-1"));
    await waitFor(() => expect(result.current.hasLoaded).toBe(true));

    server.mount(contract.experiments.getExperimentTables, { status: 500 });
    await act(() => vi.advanceTimersByTimeAsync(2 * 60_000 + 1_000));

    await waitFor(() => expect(result.current.status).toBe("behind"));
  });
});
