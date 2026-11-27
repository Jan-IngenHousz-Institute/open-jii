import { fromPartial } from "@total-typescript/shoehorn";

import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../common/utils/fp-utils";
import type { Result } from "../../../common/utils/fp-utils";
import type {
  ExperimentDataSource,
  ExperimentTableMetadata,
} from "../../core/models/experiment-data.model";
import type { ServingStorePort, StoreChangeMark } from "../../core/ports/serving-store.port";
import type { ExperimentDataRepository } from "../../core/repositories/experiment-data.repository";
import { ACCESS_CHECK_MS } from "../use-cases/experiment-data/watch-experiment-tables";
import {
  CHECK_MS,
  ExperimentTableChangesService,
  FULL_LISTING_MS,
  HEARTBEAT_MS,
  MAX_STREAMS_PER_TASK,
  MAX_STREAMS_PER_USER,
  MAX_WATCHED_EXPERIMENTS,
  STREAM_LIFETIME_JITTER_MS,
  STREAM_LIFETIME_MS,
} from "./experiment-table-changes.service";
import { RecentChecks } from "./recent-checks";

const RAW: ExperimentTableMetadata = {
  identifier: "raw_data",
  tableType: "static",
  displayName: null,
  rowCount: 10,
  latestRowAt: "2026-11-16T10:00:00.000Z",
  schemaRevision: "r1",
};

/** A change mark whose later start counts the same, as one taken with nothing in flight. */
function markOf(since: string, revision: string): StoreChangeMark {
  return { since, revision, next: { since, revision } };
}

function setup() {
  const listTablesAfresh = vi
    .fn<
      (
        experimentId: string,
        source: ExperimentDataSource,
      ) => Promise<Result<ExperimentTableMetadata[]>>
    >()
    .mockResolvedValue(success([RAW]));
  // Unless a test holds it still, the mark moves at every check, so every check reads the listing.
  let landed = 0;
  const getExperimentChangeMark = vi
    .fn<(experimentId: string, since: string | null) => Promise<Result<StoreChangeMark>>>()
    .mockImplementation(() => {
      landed += 1;
      return Promise.resolve(success(markOf("counted-from", `landed-${landed}`)));
    });
  const mayRead = vi.fn<() => Promise<boolean>>().mockResolvedValue(true);
  const service = new ExperimentTableChangesService(
    fromPartial<ExperimentDataRepository>({ listTablesAfresh }),
    fromPartial<ServingStorePort>({ getExperimentChangeMark }),
  );
  const controllers: AbortController[] = [];

  const listen = (experimentId = "exp-1", userId = "user-1") => {
    const stop = new AbortController();
    controllers.push(stop);
    const opened = service.open(experimentId, userId, mayRead, stop.signal);
    assertSuccess(opened);
    return { events: opened.value, stop };
  };
  const stopAll = () => controllers.forEach((controller) => controller.abort());

  return { service, listTablesAfresh, getExperimentChangeMark, mayRead, listen, stopAll };
}

type Repository = ReturnType<typeof setup>["listTablesAfresh"];
type AccessCheck = ReturnType<typeof setup>["mayRead"];
type Listening = ReturnType<ReturnType<typeof setup>["listen"]>;

async function drain(events: AsyncGenerator<unknown, void>): Promise<void> {
  let result = await events.next();
  while (result.done !== true) {
    result = await events.next();
  }
}

describe("ExperimentTableChangesService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("checks an experiment's store listing once per interval however many listen", async () => {
    const { listTablesAfresh, listen, stopAll } = setup();
    const listeners = [listen(), listen(), listen()];

    const first = await Promise.all(listeners.map(({ events }) => events.next()));
    await vi.advanceTimersByTimeAsync(CHECK_MS * 2);

    const current = {
      type: "changed",
      tables: [
        {
          identifier: "raw_data",
          displayName: null,
          totalRows: 10,
          latestRowAt: "2026-11-16T10:00:00.000Z",
          schemaRevision: "r1",
          contentRevision: null,
        },
      ],
    };
    expect(first.map((result) => result.value)).toEqual([current, current, current]);
    expect(listTablesAfresh).toHaveBeenCalledTimes(3);
    expect(listTablesAfresh).toHaveBeenCalledWith("exp-1", "store");
    stopAll();
  });

  it("reads the listing again only once the change mark moves, counting from where it began", async () => {
    const { listTablesAfresh, getExperimentChangeMark, listen, stopAll } = setup();
    const since = "2026-11-24 10:00:00.000000";
    getExperimentChangeMark.mockResolvedValue(success(markOf(since, "4:x")));
    const { events } = listen();
    await events.next();

    await vi.advanceTimersByTimeAsync(CHECK_MS * 3);
    expect(getExperimentChangeMark).toHaveBeenCalledTimes(4);
    expect(getExperimentChangeMark).toHaveBeenNthCalledWith(1, "exp-1", null);
    expect(getExperimentChangeMark).toHaveBeenLastCalledWith("exp-1", since);
    expect(listTablesAfresh).toHaveBeenCalledTimes(1);

    getExperimentChangeMark.mockResolvedValue(success(markOf(since, "5:x")));
    listTablesAfresh.mockResolvedValue(success([{ ...RAW, rowCount: 11 }]));
    const next = events.next();
    await vi.advanceTimersByTimeAsync(CHECK_MS);
    expect(await next).toMatchObject({ value: { tables: [{ totalRows: 11 }] } });
    expect(listTablesAfresh).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(CHECK_MS);
    expect(getExperimentChangeMark).toHaveBeenLastCalledWith("exp-1", since);
    expect(listTablesAfresh).toHaveBeenCalledTimes(2);
    stopAll();
  });

  it("reads the listing again when only the schemas or sheets move", async () => {
    const { listTablesAfresh, getExperimentChangeMark, listen, stopAll } = setup();
    getExperimentChangeMark.mockResolvedValue(success(markOf("s", "4:x|1|0:0")));
    await listen().events.next();

    getExperimentChangeMark.mockResolvedValue(success(markOf("s", "4:x|2|0:0")));
    await vi.advanceTimersByTimeAsync(CHECK_MS * 2);

    expect(listTablesAfresh).toHaveBeenCalledTimes(2);
    stopAll();
  });

  it("reads the listing in full at its interval though the change mark holds still", async () => {
    const { listTablesAfresh, getExperimentChangeMark, listen, stopAll } = setup();
    getExperimentChangeMark.mockResolvedValue(success(markOf("s", "r")));
    await listen().events.next();

    await vi.advanceTimersByTimeAsync(FULL_LISTING_MS - CHECK_MS);
    expect(listTablesAfresh).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(CHECK_MS);

    expect(listTablesAfresh).toHaveBeenCalledTimes(2);
    stopAll();
  });

  describe("moving the mark's start", () => {
    /**
     * A store whose clock has moved by each mark, so a mark counts differently from each start, and
     * whose rows arrive only when a test lands one.
     */
    function storeWithClock(mark: ReturnType<typeof setup>["getExperimentChangeMark"]) {
      const store = { marks: 0, arrivals: 0 };
      mark.mockImplementation((_experimentId, since) => {
        store.marks += 1;
        const nextSince = `cutoff-${store.marks}`;
        const counted = since ?? nextSince;
        return Promise.resolve(
          success({
            since: counted,
            revision: `${counted}:${store.arrivals}`,
            next: { since: nextSince, revision: `${nextSince}:${store.arrivals}` },
          }),
        );
      });
      return store;
    }

    it("moves the start up on a busy experiment, where a row lands before every check", async () => {
      const { listTablesAfresh, getExperimentChangeMark, listen, stopAll } = setup();
      const store = storeWithClock(getExperimentChangeMark);
      await listen().events.next();

      for (let check = 0; check < (2 * FULL_LISTING_MS) / CHECK_MS; check++) {
        store.arrivals += 1;
        await vi.advanceTimersByTimeAsync(CHECK_MS);
      }

      const checks = getExperimentChangeMark.mock.calls.length;
      expect(listTablesAfresh).toHaveBeenCalledTimes(checks);
      expect(getExperimentChangeMark).toHaveBeenLastCalledWith("exp-1", `cutoff-${checks - 1}`);
      stopAll();
    });

    it("moves the start up at each full listing, and reads no change into the move alone", async () => {
      const { listTablesAfresh, getExperimentChangeMark, listen, stopAll } = setup();
      storeWithClock(getExperimentChangeMark);
      await listen().events.next();

      await vi.advanceTimersByTimeAsync(CHECK_MS * 2);
      expect(getExperimentChangeMark).toHaveBeenLastCalledWith("exp-1", "cutoff-1");
      expect(listTablesAfresh).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(FULL_LISTING_MS - CHECK_MS * 2);
      expect(listTablesAfresh).toHaveBeenCalledTimes(2);
      const movedTo = getExperimentChangeMark.mock.calls.length;
      await vi.advanceTimersByTimeAsync(CHECK_MS * 3);

      expect(getExperimentChangeMark).toHaveBeenLastCalledWith("exp-1", `cutoff-${movedTo}`);
      expect(listTablesAfresh).toHaveBeenCalledTimes(2);
      stopAll();
    });

    it.each([
      { landing: "just before the move", ahead: 0 },
      { landing: "just after the move", ahead: CHECK_MS },
    ])("reports a row landing $landing", async ({ ahead }) => {
      const { listTablesAfresh, getExperimentChangeMark, listen, stopAll } = setup();
      const store = storeWithClock(getExperimentChangeMark);
      const { events } = listen();
      await events.next();
      await vi.advanceTimersByTimeAsync(FULL_LISTING_MS - CHECK_MS);
      expect(listTablesAfresh).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(ahead);
      store.arrivals += 1;
      listTablesAfresh.mockResolvedValue(success([{ ...RAW, rowCount: 11 }]));
      const next = events.next();
      await vi.advanceTimersByTimeAsync(CHECK_MS);

      expect(await next).toMatchObject({ value: { tables: [{ totalRows: 11 }] } });
      stopAll();
    });
  });

  it("ends every stream when the change mark cannot be read", async () => {
    const { listTablesAfresh, getExperimentChangeMark, listen } = setup();
    getExperimentChangeMark.mockResolvedValue(failure(AppError.internal("store unreachable")));

    expect(await listen().events.next()).toEqual({ value: undefined, done: true });
    expect(listTablesAfresh).not.toHaveBeenCalled();
  });

  it("sends nothing while the listing stays as it was", async () => {
    const { listen, stopAll } = setup();
    const { events } = listen();
    await events.next();

    let isSent = false;
    const next = events.next().then((result) => {
      isSent = true;
      return result;
    });
    await vi.advanceTimersByTimeAsync(CHECK_MS * 3);

    expect(isSent).toBe(false);
    stopAll();
    await next;
  });

  it("tells listeners only when the listing changes, with the newest change only", async () => {
    const { listTablesAfresh, listen, stopAll } = setup();
    const { events } = listen();
    await events.next();

    await vi.advanceTimersByTimeAsync(CHECK_MS);
    listTablesAfresh.mockResolvedValue(success([{ ...RAW, rowCount: 11 }]));
    await vi.advanceTimersByTimeAsync(CHECK_MS);
    listTablesAfresh.mockResolvedValue(success([{ ...RAW, rowCount: 12 }]));
    await vi.advanceTimersByTimeAsync(CHECK_MS);

    expect(await events.next()).toMatchObject({
      value: { type: "changed", tables: [{ identifier: "raw_data", totalRows: 12 }] },
    });
    expect(listTablesAfresh).toHaveBeenCalledTimes(4);
    stopAll();
  });

  it("tells listeners of rows replaced in place, which move only the content revision", async () => {
    const { listTablesAfresh, listen, stopAll } = setup();
    listTablesAfresh.mockResolvedValue(success([{ ...RAW, contentRevision: "arrived-1" }]));
    const { events } = listen();
    await events.next();

    listTablesAfresh.mockResolvedValue(success([{ ...RAW, contentRevision: "arrived-2" }]));
    const next = events.next();
    await vi.advanceTimersByTimeAsync(CHECK_MS);

    expect(await next).toMatchObject({
      value: {
        type: "changed",
        tables: [{ identifier: "raw_data", contentRevision: "arrived-2" }],
      },
    });
    stopAll();
  });

  it("tells listeners the name an upload now goes by", async () => {
    const upload: ExperimentTableMetadata = {
      ...RAW,
      identifier: "upload-1",
      tableType: "upload",
      displayName: "Soil cores",
    };
    const { listTablesAfresh, listen, stopAll } = setup();
    listTablesAfresh.mockResolvedValue(success([upload]));
    const { events } = listen();
    await events.next();

    listTablesAfresh.mockResolvedValue(success([{ ...upload, displayName: "Soil cores, spring" }]));
    const next = events.next();
    await vi.advanceTimersByTimeAsync(CHECK_MS);

    expect(await next).toMatchObject({
      value: {
        type: "changed",
        tables: [{ identifier: "upload-1", displayName: "Soil cores, spring" }],
      },
    });
    stopAll();
  });

  it("gives a listener who joins later the listing as it stands, without another check", async () => {
    const { listTablesAfresh, listen, stopAll } = setup();
    await listen().events.next();

    const later = await listen().events.next();

    expect(later.value).toMatchObject({ type: "changed" });
    expect(listTablesAfresh).toHaveBeenCalledTimes(1);
    stopAll();
  });

  it("stops checking when the last listener leaves, and starts again for the next", async () => {
    const { listTablesAfresh, listen, stopAll } = setup();
    const first = listen();
    const second = listen();
    await Promise.all([first.events.next(), second.events.next()]);

    first.stop.abort();
    await first.events.next();
    await vi.advanceTimersByTimeAsync(CHECK_MS);
    expect(listTablesAfresh).toHaveBeenCalledTimes(2);

    second.stop.abort();
    await second.events.next();
    await vi.advanceTimersByTimeAsync(CHECK_MS * 3);
    expect(listTablesAfresh).toHaveBeenCalledTimes(2);

    await listen().events.next();
    expect(listTablesAfresh).toHaveBeenCalledTimes(3);
    stopAll();
  });

  it("schedules no further check when the last listener leaves during one", async () => {
    const { listTablesAfresh, listen } = setup();
    let release: (result: Result<ExperimentTableMetadata[]>) => void = () => undefined;
    let markBegun: () => void = () => undefined;
    const listingBegan = new Promise<void>((resolve) => {
      markBegun = resolve;
    });
    listTablesAfresh.mockImplementationOnce(() => {
      markBegun();
      return new Promise((resolve) => {
        release = resolve;
      });
    });

    const { stop } = listen();
    await listingBegan;
    stop.abort();
    release(success([RAW]));
    await vi.advanceTimersByTimeAsync(CHECK_MS * 3);

    expect(listTablesAfresh).toHaveBeenCalledTimes(1);
  });

  it("sends a heartbeat while nothing changes", async () => {
    const { listen, stopAll } = setup();
    const { events } = listen();
    await events.next();

    const next = events.next();
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);

    expect(await next).toEqual({ value: { type: "heartbeat" }, done: false });
    stopAll();
  });

  it("ends a stream waiting for a change as soon as its request aborts", async () => {
    const { listen } = setup();
    const { events, stop } = listen();
    await events.next();

    const next = events.next();
    stop.abort();

    expect(await next).toEqual({ value: undefined, done: true });
  });

  it("ends a stream at its lifetime, and stops checking if it was the last", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { listTablesAfresh, listen } = setup();
    const { events } = listen();
    await events.next();

    await vi.advanceTimersByTimeAsync(STREAM_LIFETIME_MS - HEARTBEAT_MS * 2);
    const lastBeat = events.next();
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
    expect(await lastBeat).toEqual({ value: { type: "heartbeat" }, done: false });

    const end = events.next();
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
    expect(await end).toEqual({ value: undefined, done: true });
    const checks = listTablesAfresh.mock.calls.length;
    await vi.advanceTimersByTimeAsync(CHECK_MS * 3);

    expect(listTablesAfresh).toHaveBeenCalledTimes(checks);
  });

  it("ends a stream at its lifetime though a change waits for a slow reader", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { listTablesAfresh, listen } = setup();
    const { events } = listen();
    await events.next();

    listTablesAfresh.mockResolvedValue(success([{ ...RAW, rowCount: 11 }]));
    await vi.advanceTimersByTimeAsync(STREAM_LIFETIME_MS);

    expect(await events.next()).toEqual({ value: undefined, done: true });
  });

  it("gives back the slots of a stream whose reader stopped pulling once its lifetime is up", async () => {
    const { service, listTablesAfresh, mayRead, listen } = setup();
    const { events } = listen("exp-1", "user-1");
    await events.next();

    await vi.advanceTimersByTimeAsync(STREAM_LIFETIME_MS + STREAM_LIFETIME_JITTER_MS);
    const checks = listTablesAfresh.mock.calls.length;
    await vi.advanceTimersByTimeAsync(CHECK_MS * 3);

    expect(listTablesAfresh).toHaveBeenCalledTimes(checks);
    for (let stream = 0; stream < MAX_STREAMS_PER_USER; stream++) {
      assertSuccess(service.open("exp-2", "user-1", mayRead));
    }
  });

  it("asks before sending whether the reader may still read, and ends the stream once not", async () => {
    const { listTablesAfresh, mayRead, listen } = setup();
    const { events } = listen();
    await events.next();
    expect(mayRead).toHaveBeenCalledTimes(1);

    mayRead.mockResolvedValue(false);
    listTablesAfresh.mockResolvedValue(success([{ ...RAW, rowCount: 11 }]));
    await vi.advanceTimersByTimeAsync(CHECK_MS);

    expect(await events.next()).toEqual({ value: undefined, done: true });
    const checks = listTablesAfresh.mock.calls.length;
    await vi.advanceTimersByTimeAsync(CHECK_MS * 3);
    expect(listTablesAfresh).toHaveBeenCalledTimes(checks);
  });

  it("ends a quiet stream at its next heartbeat once the reader may no longer read", async () => {
    const { mayRead, listen } = setup();
    const { events } = listen();
    await events.next();

    mayRead.mockResolvedValue(false);
    const next = events.next();
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);

    expect(await next).toEqual({ value: undefined, done: true });
  });

  it("ends a stream whose access check fails to answer", async () => {
    const { mayRead, listen } = setup();
    mayRead.mockRejectedValue(new Error("database unreachable"));

    expect(await listen().events.next()).toEqual({ value: undefined, done: true });
  });

  it("asks before every send whether the reader may still read", async () => {
    const { listTablesAfresh, mayRead, listen, stopAll } = setup();
    const { events } = listen();
    await events.next();

    listTablesAfresh.mockResolvedValue(success([{ ...RAW, rowCount: 11 }]));
    const next = events.next();
    await vi.advanceTimersByTimeAsync(CHECK_MS);
    expect(await next).toMatchObject({ value: { tables: [{ totalRows: 11 }] } });

    expect(mayRead).toHaveBeenCalledTimes(2);
    stopAll();
  });

  it("stops each of a reader's streams within a window of losing access, however recently it asked", async () => {
    const { listTablesAfresh, mayRead, listen, stopAll } = setup();
    const answers = new RecentChecks(ACCESS_CHECK_MS);
    const authority = vi.fn<() => Promise<boolean>>().mockResolvedValue(true);
    mayRead.mockImplementation(() => answers.ask("reader", authority).then(({ isTrue }) => isTrue));
    await listen().events.next();
    authority.mockResolvedValue(false);

    await vi.advanceTimersByTimeAsync(ACCESS_CHECK_MS - 1_000);
    const later = listen();
    await later.events.next();
    listTablesAfresh.mockResolvedValue(success([{ ...RAW, rowCount: 11 }]));
    const next = later.events.next();
    await vi.advanceTimersByTimeAsync(2_000);

    expect(await next).toEqual({ value: undefined, done: true });
    expect(authority).toHaveBeenCalledTimes(2);
    stopAll();
  });

  it("ends every stream when a check fails, so its client checks on its own", async () => {
    const { listTablesAfresh, listen } = setup();
    listTablesAfresh.mockResolvedValue(failure(AppError.internal("store unreachable")));

    const results = await Promise.all([listen().events.next(), listen().events.next()]);

    expect(results).toEqual([
      { value: undefined, done: true },
      { value: undefined, done: true },
    ]);
  });

  it("keeps a newer watch checking when a failed watch's listener leaves after it started", async () => {
    const { listTablesAfresh, listen, stopAll } = setup();
    listTablesAfresh.mockResolvedValueOnce(failure(AppError.internal("store unreachable")));

    const old = listen();
    await vi.advanceTimersByTimeAsync(0);
    const fresh = listen();
    await fresh.events.next();
    await old.events.next();
    await vi.advanceTimersByTimeAsync(CHECK_MS * 2);

    expect(listTablesAfresh).toHaveBeenCalledTimes(4);
    stopAll();
  });

  it("refuses a user's stream past their cap, and lets another user's open", () => {
    const { service, mayRead, listen, stopAll } = setup();
    for (let stream = 0; stream < MAX_STREAMS_PER_USER; stream++) {
      listen("exp-1", "user-1");
    }

    const refused = service.open("exp-1", "user-1", mayRead);
    const another = service.open("exp-1", "user-2", mayRead);

    assertFailure(refused);
    expect(refused.error.statusCode).toBe(429);
    assertSuccess(another);
    stopAll();
  });

  it("refuses a new experiment past the task's cap, and still joins a followed one", () => {
    const { service, mayRead, listen, stopAll } = setup();
    for (let experiment = 0; experiment < MAX_WATCHED_EXPERIMENTS; experiment++) {
      listen(`exp-${experiment}`, `user-${experiment}`);
    }

    const refused = service.open("exp-new", "user-new", mayRead);
    const followed = service.open("exp-0", "user-new", mayRead);

    assertFailure(refused);
    expect(refused.error.statusCode).toBe(503);
    assertSuccess(followed);
    stopAll();
  });

  it("refuses any stream past the task's cap, on a followed experiment too, until one ends", () => {
    const { service, mayRead, listen, stopAll } = setup();
    const streams = Array.from({ length: MAX_STREAMS_PER_TASK }, (_, stream) =>
      listen("exp-1", `user-${stream}`),
    );

    const refused = service.open("exp-1", "user-new", mayRead);
    assertFailure(refused);
    expect(refused.error.statusCode).toBe(503);

    streams[0].stop.abort();
    assertSuccess(service.open("exp-1", "user-new", mayRead));
    stopAll();
  });

  it("ends every stream on shutdown, so the server can close", async () => {
    const { service, listen } = setup();
    const { events } = listen();
    await events.next();

    const next = events.next();
    service.onModuleDestroy();

    expect(await next).toEqual({ value: undefined, done: true });
  });

  it("holds nothing for a request that aborted before its stream opened", async () => {
    const { service, listTablesAfresh, mayRead, listen, stopAll } = setup();
    const gone = new AbortController();
    gone.abort();

    for (let stream = 0; stream < MAX_STREAMS_PER_USER; stream++) {
      assertSuccess(service.open("exp-1", "user-1", mayRead, gone.signal));
    }
    await vi.advanceTimersByTimeAsync(0);
    const checks = listTablesAfresh.mock.calls.length;

    listen("exp-2", "user-1");
    await vi.advanceTimersByTimeAsync(CHECK_MS * 3);

    const checksOfFirst = listTablesAfresh.mock.calls.filter(([id]) => id === "exp-1").length;
    expect(checksOfFirst).toBe(checks);
    stopAll();
  });

  it.each([
    {
      exit: "an abort",
      end: async (stream: Listening) => {
        stream.stop.abort();
        await stream.events.next();
      },
    },
    {
      exit: "its lifetime",
      end: async (stream: Listening) => {
        const ended = drain(stream.events);
        await vi.advanceTimersByTimeAsync(STREAM_LIFETIME_MS + STREAM_LIFETIME_JITTER_MS);
        await ended;
      },
    },
    {
      exit: "a failed check",
      end: async (stream: Listening, repository: Repository) => {
        repository.mockResolvedValue(failure(AppError.internal("store unreachable")));
        await vi.advanceTimersByTimeAsync(CHECK_MS);
        await drain(stream.events);
      },
    },
    {
      exit: "a shutdown",
      end: async (stream: Listening, _: Repository, service: ExperimentTableChangesService) => {
        service.onModuleDestroy();
        await drain(stream.events);
      },
    },
    {
      exit: "lost access",
      end: async (
        stream: Listening,
        _: Repository,
        __: ExperimentTableChangesService,
        mayRead: AccessCheck,
      ) => {
        mayRead.mockResolvedValue(false);
        const ended = drain(stream.events);
        await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);
        await ended;
      },
    },
  ])("gives a user back a stream that ended through $exit", async ({ end }) => {
    const { service, listTablesAfresh, mayRead, listen, stopAll } = setup();
    const streams = Array.from({ length: MAX_STREAMS_PER_USER }, () => listen());
    await streams[0].events.next();

    await end(streams[0], listTablesAfresh, service, mayRead);

    mayRead.mockResolvedValue(true);
    assertSuccess(service.open("exp-1", "user-1", mayRead));
    stopAll();
  });
});
