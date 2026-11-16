import { fromPartial } from "@total-typescript/shoehorn";

import { AppError, failure, success } from "../../../common/utils/fp-utils";
import type { ExperimentTableMetadata } from "../../core/models/experiment-data.model";
import type { ExperimentDataRepository } from "../../core/repositories/experiment-data.repository";
import {
  CHECK_MS,
  ExperimentTableChangesService,
  HEARTBEAT_MS,
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
  const listedTablesMetadata = vi.fn().mockResolvedValue(success([RAW]));
  const service = new ExperimentTableChangesService(
    fromPartial<ExperimentDataRepository>({ listedTablesMetadata }),
  );
  const controllers: AbortController[] = [];
  const listen = (experimentId = "exp-1") => {
    const controller = new AbortController();
    controllers.push(controller);
    return { events: service.listen(experimentId, controller.signal), stop: controller };
  };
  return { service, listedTablesMetadata, listen, controllers };
}

describe("ExperimentTableChangesService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("checks an experiment's store listing once per interval however many listen", async () => {
    const { listedTablesMetadata, listen, controllers } = setup();
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
    expect(first.map(({ value }) => value)).toEqual([current, current, current]);
    expect(listedTablesMetadata).toHaveBeenCalledTimes(3);
    expect(listedTablesMetadata).toHaveBeenCalledWith("exp-1", "store");
    controllers.forEach((controller) => controller.abort());
  });

  it("tells listeners only when the listing changes", async () => {
    const { listedTablesMetadata, listen, controllers } = setup();
    const { events } = listen();
    await events.next();

    const next = events.next();
    await vi.advanceTimersByTimeAsync(CHECK_MS);
    listedTablesMetadata.mockResolvedValue(success([{ ...RAW, rowCount: 11 }]));
    await vi.advanceTimersByTimeAsync(CHECK_MS);

    expect(await next).toMatchObject({
      value: { type: "changed", tables: [{ identifier: "raw_data", totalRows: 11 }] },
    });
    expect(listedTablesMetadata).toHaveBeenCalledTimes(3);
    controllers.forEach((controller) => controller.abort());
  });

  it("gives a listener who joins later the listing as it stands, without another check", async () => {
    const { listedTablesMetadata, listen, controllers } = setup();
    await listen().events.next();

    const later = await listen().events.next();

    expect(later.value).toMatchObject({ type: "changed" });
    expect(listedTablesMetadata).toHaveBeenCalledTimes(1);
    controllers.forEach((controller) => controller.abort());
  });

  it("stops checking when the last listener leaves, and starts again for the next", async () => {
    const { listedTablesMetadata, listen } = setup();
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

    const third = listen();
    await third.events.next();
    expect(listedTablesMetadata).toHaveBeenCalledTimes(3);
    third.stop.abort();
  });

  it("sends a heartbeat while nothing changes", async () => {
    const { listen, controllers } = setup();
    const { events } = listen();
    await events.next();

    const next = events.next();
    await vi.advanceTimersByTimeAsync(HEARTBEAT_MS);

    expect(await next).toEqual({ value: { type: "heartbeat" }, done: false });
    controllers.forEach((controller) => controller.abort());
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
});
