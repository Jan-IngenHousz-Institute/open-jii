import { fromPartial } from "@total-typescript/shoehorn";

import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../common/utils/fp-utils";
import type { Result } from "../../../common/utils/fp-utils";
import type { ExperimentTableMetadata } from "../../core/models/experiment-data.model";
import type { ExperimentDataRepository } from "../../core/repositories/experiment-data.repository";
import {
  CHECK_MS,
  ExperimentTableChangesService,
  HEARTBEAT_MS,
  MAX_STREAMS_PER_USER,
  MAX_WATCHED_EXPERIMENTS,
  STREAM_LIFETIME_MS,
} from "./experiment-table-changes.service";

const RAW: ExperimentTableMetadata = {
  identifier: "raw_data",
  tableType: "static",
  displayName: null,
  rowCount: 10,
  latestRowAt: "2026-11-16T10:00:00.000Z",
  schemaRevision: "r1",
};

function setup() {
  const listedTablesMetadata = vi
    .fn<() => Promise<Result<ExperimentTableMetadata[]>>>()
    .mockResolvedValue(success([RAW]));
  const service = new ExperimentTableChangesService(
    fromPartial<ExperimentDataRepository>({ listedTablesMetadata }),
  );
  const controllers: AbortController[] = [];

  const listen = (experimentId = "exp-1", userId = "user-1") => {
    const stop = new AbortController();
    controllers.push(stop);
    const opened = service.open(experimentId, userId, stop.signal);
    assertSuccess(opened);
    return { events: opened.value, stop };
  };
  const stopAll = () => controllers.forEach((controller) => controller.abort());

  return { service, listedTablesMetadata, listen, stopAll };
}

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
    const { listedTablesMetadata, listen, stopAll } = setup();
    const listeners = [listen(), listen(), listen()];

    const first = await Promise.all(listeners.map(({ events }) => events.next()));
    await vi.advanceTimersByTimeAsync(CHECK_MS * 2);

    const current = {
      type: "changed",
      tables: [
        {
          identifier: "raw_data",
          totalRows: 10,
          latestRowAt: "2026-11-16T10:00:00.000Z",
          schemaRevision: "r1",
        },
      ],
    };
    expect(first.map((result) => result.value)).toEqual([current, current, current]);
    expect(listedTablesMetadata).toHaveBeenCalledTimes(3);
    expect(listedTablesMetadata).toHaveBeenCalledWith("exp-1", "store");
    stopAll();
  });

  it("tells listeners only when the listing changes, with the newest change only", async () => {
    const { listedTablesMetadata, listen, stopAll } = setup();
    const { events } = listen();
    await events.next();

    await vi.advanceTimersByTimeAsync(CHECK_MS);
    listedTablesMetadata.mockResolvedValue(success([{ ...RAW, rowCount: 11 }]));
    await vi.advanceTimersByTimeAsync(CHECK_MS);
    listedTablesMetadata.mockResolvedValue(success([{ ...RAW, rowCount: 12 }]));
    await vi.advanceTimersByTimeAsync(CHECK_MS);

    expect(await events.next()).toMatchObject({
      value: { type: "changed", tables: [{ identifier: "raw_data", totalRows: 12 }] },
    });
    expect(listedTablesMetadata).toHaveBeenCalledTimes(4);
    stopAll();
  });

  it("gives a listener who joins later the listing as it stands, without another check", async () => {
    const { listedTablesMetadata, listen, stopAll } = setup();
    await listen().events.next();

    const later = await listen().events.next();

    expect(later.value).toMatchObject({ type: "changed" });
    expect(listedTablesMetadata).toHaveBeenCalledTimes(1);
    stopAll();
  });

  it("stops checking when the last listener leaves, and starts again for the next", async () => {
    const { listedTablesMetadata, listen, stopAll } = setup();
    const first = listen();
    const second = listen();
    await Promise.all([first.events.next(), second.events.next()]);

    first.stop.abort();
    await first.events.next();
    await vi.advanceTimersByTimeAsync(CHECK_MS);
    expect(listedTablesMetadata).toHaveBeenCalledTimes(2);

    second.stop.abort();
    await second.events.next();
    await vi.advanceTimersByTimeAsync(CHECK_MS * 3);
    expect(listedTablesMetadata).toHaveBeenCalledTimes(2);

    await listen().events.next();
    expect(listedTablesMetadata).toHaveBeenCalledTimes(3);
    stopAll();
  });

  it("schedules no further check when the last listener leaves during one", async () => {
    const { listedTablesMetadata, listen } = setup();
    let release: (result: Result<ExperimentTableMetadata[]>) => void = () => undefined;
    listedTablesMetadata.mockReturnValueOnce(
      new Promise((resolve) => {
        release = resolve;
      }),
    );

    const { stop } = listen();
    stop.abort();
    release(success([RAW]));
    await vi.advanceTimersByTimeAsync(CHECK_MS * 3);

    expect(listedTablesMetadata).toHaveBeenCalledTimes(1);
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

  it("ends a stream at its lifetime, and stops checking if it was the last", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const { listedTablesMetadata, listen } = setup();
    const { events } = listen();

    const ended = drain(events);
    await vi.advanceTimersByTimeAsync(STREAM_LIFETIME_MS);
    await ended;
    const checks = listedTablesMetadata.mock.calls.length;
    await vi.advanceTimersByTimeAsync(CHECK_MS * 3);

    expect(listedTablesMetadata).toHaveBeenCalledTimes(checks);
  });

  it("ends every stream when a check fails, so its client checks on its own", async () => {
    const { listedTablesMetadata, listen } = setup();
    listedTablesMetadata.mockResolvedValue(failure(AppError.internal("store unreachable")));

    const results = await Promise.all([listen().events.next(), listen().events.next()]);

    expect(results).toEqual([
      { value: undefined, done: true },
      { value: undefined, done: true },
    ]);
  });

  it("keeps a newer watch checking when a failed watch's listener leaves after it started", async () => {
    const { listedTablesMetadata, listen, stopAll } = setup();
    listedTablesMetadata.mockResolvedValueOnce(failure(AppError.internal("store unreachable")));

    const old = listen();
    await vi.advanceTimersByTimeAsync(0);
    const fresh = listen();
    await fresh.events.next();
    await old.events.next();
    await vi.advanceTimersByTimeAsync(CHECK_MS * 2);

    expect(listedTablesMetadata).toHaveBeenCalledTimes(4);
    stopAll();
  });

  it("refuses a user's stream past their cap, and lets another user's open", () => {
    const { service, listen, stopAll } = setup();
    for (let stream = 0; stream < MAX_STREAMS_PER_USER; stream++) {
      listen("exp-1", "user-1");
    }

    const refused = service.open("exp-1", "user-1");
    const another = service.open("exp-1", "user-2");

    assertFailure(refused);
    expect(refused.error.statusCode).toBe(429);
    assertSuccess(another);
    stopAll();
  });

  it("refuses a new experiment past the task's cap, and still joins a followed one", () => {
    const { service, listen, stopAll } = setup();
    for (let experiment = 0; experiment < MAX_WATCHED_EXPERIMENTS; experiment++) {
      listen(`exp-${experiment}`, `user-${experiment}`);
    }

    const refused = service.open("exp-new", "user-new");
    const followed = service.open("exp-0", "user-new");

    assertFailure(refused);
    expect(refused.error.statusCode).toBe(503);
    assertSuccess(followed);
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
});
