import { faker } from "@faker-js/faker";

import { eq, experimentDataOutbox, sql } from "@repo/database";

import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import type { OwedRecord } from "../models/experiment-data-outbox.model";
import { ExperimentDataOutboxRepository } from "./experiment-data-outbox.repository";

describe("ExperimentDataOutboxRepository", () => {
  const testApp = TestHarness.App;
  let repository: ExperimentDataOutboxRepository;

  const LEASE_MS = 5 * 60_000;
  const WAITS = [10, 60, 300];

  function annotation(): OwedRecord {
    return {
      recordType: "annotation",
      recordId: faker.string.uuid(),
      experimentId: faker.string.uuid(),
    };
  }

  function rows() {
    return testApp.database.select().from(experimentDataOutbox);
  }

  async function owe(...records: OwedRecord[]): Promise<void> {
    await testApp.database.transaction((tx) => repository.owe(tx, records));
  }

  async function claim(limit = 10) {
    const claimed = await repository.claimDue(LEASE_MS, limit);
    assertSuccess(claimed);
    return claimed.value;
  }

  /** Moves a row's times into the past, as if it had waited or been held that long. */
  async function age(id: string, seconds: number): Promise<void> {
    await testApp.database.execute(sql`
      UPDATE experiment_data_outbox
      SET next_attempt_at = next_attempt_at - make_interval(secs => ${seconds}),
          claimed_at = claimed_at - make_interval(secs => ${seconds})
      WHERE id = ${id}
    `);
  }

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    repository = testApp.module.get(ExperimentDataOutboxRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("owes a record's state to each copy it keeps, due now", async () => {
    const record = annotation();

    await owe(record);

    expect(await rows()).toEqual([
      expect.objectContaining({
        ...record,
        destination: "lakehouse",
        attempts: 0,
        claimedAt: null,
      }),
    ]);
    expect(await claim()).toHaveLength(1);
  });

  it("keeps one waiting row however often a record changes", async () => {
    const record = annotation();

    await owe(record, record);
    await owe(record);

    expect(await rows()).toHaveLength(1);
  });

  it("makes a waiting row due again when its record changes during a backoff", async () => {
    const record = annotation();
    await owe(record);
    const [held] = await claim();
    assertSuccess(await repository.markRetry([held], [3600], "Warehouse down"));
    expect(await claim()).toEqual([]);

    await owe(record);

    expect(await claim()).toEqual([expect.objectContaining({ recordId: record.recordId })]);
  });

  it("queues a second row when a record changes while its row is claimed", async () => {
    const record = annotation();
    await owe(record);
    await claim();

    await owe(record);

    const all = await rows();
    expect(all).toHaveLength(2);
    expect(all.filter((row) => row.claimedAt === null)).toHaveLength(1);
  });

  it("claims due rows only, up to the limit, and never the same row twice", async () => {
    await owe(annotation(), annotation(), annotation());

    const first = await claim(2);
    const second = await claim(2);
    const third = await claim(2);

    expect(first).toHaveLength(2);
    expect(second).toHaveLength(1);
    expect(third).toEqual([]);
    expect(new Set([...first, ...second].map((row) => row.id)).size).toBe(3);
  });

  it("takes back a row held past its lease, counting the attempt", async () => {
    await owe(annotation());
    const [held] = await claim();
    expect(await claim()).toEqual([]);

    await age(held.id, LEASE_MS / 1000 + 1);

    expect(await claim()).toEqual([expect.objectContaining({ id: held.id, attempts: 1 })]);
  });

  it("holds a record's new row back while another task copies the record", async () => {
    const record = annotation();
    await owe(record);
    const [held] = await claim();
    await owe(record);

    expect(await claim()).toEqual([]);

    assertSuccess(await repository.markApplied([held]));
    expect(await claim()).toEqual([
      expect.objectContaining({ recordId: record.recordId, attempts: 0 }),
    ]);
  });

  it("offers a record's waiting row before an abandoned claim of it", async () => {
    const record = annotation();
    await owe(record);
    const [abandoned] = await claim();
    await owe(record);
    await age(abandoned.id, LEASE_MS / 1000 + 1);

    const [waiting] = await claim();

    expect(waiting.id).not.toBe(abandoned.id);
    expect(await claim()).toEqual([]);
    assertSuccess(await repository.markApplied([waiting]));
    expect(await claim()).toEqual([expect.objectContaining({ id: abandoned.id })]);
  });

  it("takes one of two abandoned claims of a record at a time", async () => {
    const record = annotation();
    await owe(record);
    await claim();
    await owe(record);
    await testApp.database.execute(sql`
      UPDATE experiment_data_outbox
      SET claimed_at = (now() AT TIME ZONE 'UTC') - interval '1 day'
    `);

    const taken = await claim();

    expect(taken).toHaveLength(1);
    expect(taken[0].id).toBe((await rows()).map(({ id }) => id).sort()[0]);
  });

  it("deletes applied rows, but not one another task has taken back since", async () => {
    await owe(annotation(), annotation());
    const [kept, applied] = await claim();
    // Another task's claim: a later stamp on the same row.
    await testApp.database
      .update(experimentDataOutbox)
      .set({ claimedAt: new Date(kept.claimedAt.getTime() + LEASE_MS + 1000) })
      .where(eq(experimentDataOutbox.id, kept.id));

    const deleted = await repository.markApplied([kept, applied]);

    assertSuccess(deleted);
    expect(deleted.value).toBe(1);
    expect((await rows()).map((row) => row.id)).toEqual([kept.id]);
  });

  it("puts a failed row back with its error, due after the next wait", async () => {
    await owe(annotation());
    const [held] = await claim();

    const retried = await repository.markRetry([held], WAITS, "Warehouse down");

    assertSuccess(retried);
    expect(retried.value).toBe(1);
    const [row] = await rows();
    expect(row).toEqual(
      expect.objectContaining({ attempts: 1, claimedAt: null, lastError: "Warehouse down" }),
    );
    const [{ wait }] = await testApp.database.execute<{ wait: number }>(sql`
      SELECT extract(epoch FROM next_attempt_at - (now() AT TIME ZONE 'UTC'))::int AS wait
      FROM experiment_data_outbox
    `);
    expect(wait).toBeGreaterThan(WAITS[0] - 3);
    expect(wait).toBeLessThanOrEqual(WAITS[0]);
  });

  it("repeats the last wait once the waits run out", async () => {
    await owe(annotation());
    const [held] = await claim();
    await testApp.database
      .update(experimentDataOutbox)
      .set({ attempts: 10 })
      .where(eq(experimentDataOutbox.id, held.id));

    assertSuccess(await repository.markRetry([held], WAITS, "Warehouse down"));

    const [{ wait }] = await testApp.database.execute<{ wait: number }>(sql`
      SELECT extract(epoch FROM next_attempt_at - (now() AT TIME ZONE 'UTC'))::int AS wait
      FROM experiment_data_outbox
    `);
    expect(wait).toBeGreaterThan(WAITS[2] - 3);
  });

  it("drops a failed row whose record changed again while it was held", async () => {
    const record = annotation();
    await owe(record);
    const [held] = await claim();
    await owe(record);

    assertSuccess(await repository.markRetry([held], WAITS, "Warehouse down"));

    const all = await rows();
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual(expect.objectContaining({ claimedAt: null, attempts: 0 }));
    expect(all[0].id).not.toBe(held.id);
  });

  it("releases a row a stopped copy never reached as it was, due at once", async () => {
    await owe(annotation());
    const [held] = await claim();

    const released = await repository.release([held]);

    assertSuccess(released);
    expect(released.value).toBe(1);
    expect(await rows()).toEqual([
      expect.objectContaining({ attempts: 0, claimedAt: null, lastError: null }),
    ]);
    expect(await claim()).toHaveLength(1);
  });

  it("drops a released row whose record changed again while it was held", async () => {
    const record = annotation();
    await owe(record);
    const [held] = await claim();
    await owe(record);

    assertSuccess(await repository.release([held]));

    const all = await rows();
    expect(all).toHaveLength(1);
    expect(all[0].id).not.toBe(held.id);
  });

  it("runs a put-back once more when a twin committed between its two statements", async () => {
    await owe(annotation());
    const [held] = await claim();
    const clash = Object.assign(new Error("duplicate key value"), { cause: { code: "23505" } });
    const transaction = vi.spyOn(testApp.database, "transaction").mockRejectedValueOnce(clash);

    assertSuccess(await repository.markRetry([held], WAITS, "Warehouse down"));

    expect(transaction).toHaveBeenCalledTimes(2);
    expect(await rows()).toEqual([expect.objectContaining({ attempts: 1, claimedAt: null })]);
  });

  it("fails a put-back on any other error without running it again", async () => {
    await owe(annotation());
    const [held] = await claim();
    const transaction = vi
      .spyOn(testApp.database, "transaction")
      .mockRejectedValueOnce(new Error("connection lost"));

    const retried = await repository.markRetry([held], WAITS, "Warehouse down");

    expect(retried.isFailure()).toBe(true);
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
