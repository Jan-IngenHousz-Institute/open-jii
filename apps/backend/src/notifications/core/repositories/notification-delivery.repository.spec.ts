import {
  createSecondaryDatabase,
  eq,
  notificationDeliveries,
  notifications,
  sql as sqlRaw,
} from "@repo/database";

import { assertSuccess } from "../../../common/utils/fp-utils";
import { claimedRow } from "../../../test/notification-deliveries";
import { TestHarness } from "../../../test/test-harness";
import { NotificationDeliveryRepository } from "./notification-delivery.repository";

const LEASE_MS = 5 * 60_000;
const MINUTE = 60_000;

describe("NotificationDeliveryRepository", () => {
  const testApp = TestHarness.App;
  let repository: NotificationDeliveryRepository;
  let recipientId: string;
  let actorId: string;
  const experimentId = crypto.randomUUID();

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    repository = testApp.module.get(NotificationDeliveryRepository);
    actorId = await testApp.createTestUser({ name: "Ada Lovelace" });
    recipientId = await testApp.createTestUser({ email: "recipient@example.com" });
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  /**
   * One queued email, with the delivery row put in whatever state the case needs.
   * Due a second ago rather than at the column's default of now: "due" is a boundary
   * the caller's clock and the database's clock both have to agree on, and a claim
   * test should be about the claim.
   */
  async function seedDelivery(
    state: { status?: string; nextAttemptAt?: Date; claimedAt?: Date; attempts?: number } = {},
  ) {
    const [notification] = await testApp.database
      .insert(notifications)
      .values({
        recipientId,
        type: "experiment_join_request_received",
        actorId,
        resourceType: "experiment",
        resourceId: experimentId,
        params: { experimentName: "Photosynthesis" },
      })
      .returning();

    const [delivery] = await testApp.database
      .insert(notificationDeliveries)
      .values({
        notificationId: notification.id,
        channel: "email",
        nextAttemptAt: state.nextAttemptAt ?? new Date(Date.now() - 1_000),
        ...(state.status ? { status: state.status } : {}),
        ...(state.claimedAt ? { claimedAt: state.claimedAt } : {}),
        ...(state.attempts === undefined ? {} : { attempts: state.attempts }),
      })
      .returning();

    return { notification, delivery };
  }

  const setDelivery = (id: string, values: Partial<typeof notificationDeliveries.$inferInsert>) =>
    testApp.database
      .update(notificationDeliveries)
      .set(values)
      .where(eq(notificationDeliveries.id, id));

  const rowById = async (id: string) => {
    const [row] = await testApp.database
      .select()
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.id, id));
    return row;
  };

  it("claims a due row, marks it sending, and returns what the email needs", async () => {
    const { notification, delivery } = await seedDelivery();
    const now = new Date();

    const claimed = await repository.claimDue(LEASE_MS);

    assertSuccess(claimed);
    const stamped = await rowById(delivery.id);
    expect(claimed.value).toEqual({
      id: delivery.id,
      notificationId: notification.id,
      channel: "email",
      status: "sending",
      attempts: 0,
      // The claim a later write has to still hold, and it has to be the value the
      // row actually carries: fencing compares the two for equality.
      claimedAt: stamped.claimedAt,
      recipientId,
      type: "experiment_join_request_received",
      actorId,
      resourceType: "experiment",
      resourceId: experimentId,
      params: { experimentName: "Photosynthesis" },
    });
    expect(stamped).toMatchObject({ status: "sending" });
    // Stamped by the database, not the caller, so pin that it was set and is recent.
    expect(stamped.claimedAt).toBeInstanceOf(Date);
    expect(Math.abs(Number(stamped.claimedAt) - now.getTime())).toBeLessThan(30_000);
  });

  it("leaves a row that is not due yet", async () => {
    await seedDelivery({ nextAttemptAt: new Date(Date.now() + 10 * MINUTE) });

    const claimed = await repository.claimDue(LEASE_MS);

    assertSuccess(claimed);
    expect(claimed.value).toBeNull();
  });

  it("takes the oldest due row, then the next one", async () => {
    const now = new Date();
    const older = await seedDelivery({ nextAttemptAt: new Date(now.getTime() - 2 * MINUTE) });
    const newer = await seedDelivery({ nextAttemptAt: new Date(now.getTime() - MINUTE) });

    const first = await repository.claimDue(LEASE_MS);
    const second = await repository.claimDue(LEASE_MS);
    const third = await repository.claimDue(LEASE_MS);

    assertSuccess(first);
    assertSuccess(second);
    assertSuccess(third);
    expect(first.value?.id).toBe(older.delivery.id);
    expect(second.value?.id).toBe(newer.delivery.id);
    expect(third.value).toBeNull();
  });

  it("takes back a claim older than the lease and leaves a fresh one alone", async () => {
    const now = new Date();
    const abandoned = await seedDelivery({
      status: "sending",
      claimedAt: new Date(now.getTime() - 6 * MINUTE),
    });
    const inFlight = await seedDelivery({
      status: "sending",
      claimedAt: new Date(now.getTime() - MINUTE),
    });

    const claimed = await repository.claimDue(LEASE_MS);

    assertSuccess(claimed);
    expect(claimed.value?.id).toBe(abandoned.delivery.id);
    // Taking a claim back counts the attempt nobody finished, so a row that is
    // abandoned every time still runs out of attempts instead of looping forever.
    expect(claimed.value?.attempts).toBe(1);
    expect(await rowById(abandoned.delivery.id)).toMatchObject({ attempts: 1 });
    // The fresh claim is untouched, count included.
    expect(await rowById(inFlight.delivery.id)).toMatchObject({
      claimedAt: new Date(now.getTime() - MINUTE),
      attempts: 0,
    });
  });

  it("leaves the count alone on a row claimed while pending", async () => {
    const { delivery } = await seedDelivery({ attempts: 2 });

    const claimed = await repository.claimDue(LEASE_MS);

    assertSuccess(claimed);
    expect(claimed.value?.attempts).toBe(2);
    expect(await rowById(delivery.id)).toMatchObject({ attempts: 2 });
  });

  describe("fencing an outcome on the claim it belongs to", () => {
    it("writes when the claim is still held", async () => {
      await seedDelivery();
      const claimed = await repository.claimDue(LEASE_MS);
      assertSuccess(claimed);
      const claim = claimedRow(claimed.value);

      const marked = await repository.markSent(claim, new Date());

      assertSuccess(marked);
      expect(marked.value).toBe(true);
      expect(await rowById(claim.id)).toMatchObject({ status: "sent", claimedAt: null });
    });

    it("writes nothing when the row has been reclaimed since", async () => {
      await seedDelivery();
      const first = await repository.claimDue(LEASE_MS);
      assertSuccess(first);
      const stale = claimedRow(first.value);

      // The lease hands the row to another task, which is what a stalled sender wakes
      // up to find; its claim stamp is no longer the one on the row.
      await setDelivery(stale.id, { claimedAt: new Date(Date.now() - 6 * MINUTE) });
      const second = await repository.claimDue(LEASE_MS);
      assertSuccess(second);
      const held = claimedRow(second.value);
      assertSuccess(await repository.markSent(held, new Date()));

      const late = await repository.markRetry(stale, {
        attempts: 1,
        delayMs: MINUTE,
        lastError: "a stalled task catching up",
      });

      // The row keeps the state its real owner left it in, so the email goes out once.
      assertSuccess(late);
      expect(await rowById(stale.id)).toMatchObject({ status: "sent", attempts: 1 });
      expect(late.value).toBe(false);
    });

    it("writes nothing from a stale claim while the replacement is still sending", async () => {
      await seedDelivery();
      const first = await repository.claimDue(LEASE_MS);
      assertSuccess(first);
      const stale = claimedRow(first.value);

      // Handed on by the lease and still in flight: the replacement has not recorded
      // an outcome yet, so the row is `sending` under somebody else's claim.
      await setDelivery(stale.id, { claimedAt: new Date(Date.now() - 6 * MINUTE) });
      const second = await repository.claimDue(LEASE_MS);
      assertSuccess(second);
      const held = claimedRow(second.value);

      const sent = await repository.markSent(stale, new Date());
      const retried = await repository.markRetry(stale, {
        attempts: 3,
        delayMs: MINUTE,
        lastError: "a stalled task catching up",
      });
      const failed = await repository.markFailed(stale, { attempts: 5, lastError: "too late" });

      assertSuccess(sent);
      assertSuccess(retried);
      assertSuccess(failed);
      // The row still belongs to the task that holds it, untouched by all three.
      expect(await rowById(stale.id)).toMatchObject({
        status: "sending",
        claimedAt: held.claimedAt,
        attempts: held.attempts,
      });
      expect([sent.value, retried.value, failed.value]).toEqual([false, false, false]);
    });

    it("parses the claim stamp to the instant the row holds, whatever the session zone", async () => {
      await seedDelivery();
      const claimed = await repository.claimDue(LEASE_MS);
      assertSuccess(claimed);
      const claim = claimedRow(claimed.value);

      // Read as an epoch by the database itself, so the comparison owes nothing to
      // how this process or this session happens to be offset from UTC.
      const [{ epochMs }] = await testApp.database.execute<{ epochMs: string }>(
        sqlRaw`SELECT (extract(epoch from ${notificationDeliveries.claimedAt}) * 1000)::bigint::text AS "epochMs"
               FROM ${notificationDeliveries}
               WHERE ${notificationDeliveries.id} = ${claim.id}`,
      );

      expect(claim.claimedAt.getTime()).toBe(Number(epochMs));
    });

    it("writes nothing when the row is no longer sending", async () => {
      await seedDelivery();
      const claimed = await repository.claimDue(LEASE_MS);
      assertSuccess(claimed);
      const claim = claimedRow(claimed.value);
      assertSuccess(await repository.markSent(claim, new Date()));

      const second = await repository.markFailed(claim, { attempts: 5, lastError: "too late" });

      assertSuccess(second);
      expect(await rowById(claim.id)).toMatchObject({ status: "sent" });
      expect(second.value).toBe(false);
    });
  });

  it("steps over a row another task is already holding", async () => {
    const held = await seedDelivery();
    const free = await seedDelivery();
    // The shared handle pools one connection, so a second one is what makes this a
    // race in Postgres rather than two calls the driver ran one after the other.
    const blocker = createSecondaryDatabase();

    try {
      let locked!: () => void;
      let release!: () => void;
      const rowLocked = new Promise<void>((resolve) => (locked = resolve));
      const lockReleased = new Promise<void>((resolve) => (release = resolve));

      const holding = blocker.database.transaction(async (tx) => {
        await tx
          .select()
          .from(notificationDeliveries)
          .where(eq(notificationDeliveries.id, held.delivery.id))
          .for("update");
        locked();
        await lockReleased;
      });
      await rowLocked;

      // Raced against a timer rather than simply awaited: without SKIP LOCKED the
      // claim sits on the other task's lock, and a test that hangs leaves this
      // transaction open and takes every spec after it down with it.
      const claimed = await Promise.race([
        repository.claimDue(LEASE_MS),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("claimDue waited for a row another task held")), 2_000),
        ),
      ]).finally(release);
      await holding;

      assertSuccess(claimed);
      expect(claimed.value?.id).toBe(free.delivery.id);
      expect(await rowById(held.delivery.id)).toMatchObject({ status: "pending" });
    } finally {
      await blocker.close();
    }
  });

  it("never hands two tasks claiming at once the same row", async () => {
    const seeded = await Promise.all(Array.from({ length: 2 }, () => seedDelivery()));
    const secondary = createSecondaryDatabase();

    try {
      const otherTask = new NotificationDeliveryRepository(secondary.database);

      const [first, second] = await Promise.all([
        repository.claimDue(LEASE_MS),
        otherTask.claimDue(LEASE_MS),
      ]);

      assertSuccess(first);
      assertSuccess(second);
      // Each took one of the two, and between them they took both: `SKIP LOCKED`
      // sent the second claim past the row the first was taking rather than onto it.
      expect(first.value).not.toBeNull();
      expect(second.value).not.toBeNull();
      expect([first.value?.id, second.value?.id].sort()).toEqual(
        seeded.map(({ delivery }) => delivery.id).sort(),
      );

      const third = await repository.claimDue(LEASE_MS);
      assertSuccess(third);
      expect(third.value).toBeNull();
    } finally {
      await secondary.close();
    }
  });
});
