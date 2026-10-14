import { createSecondaryDatabase, eq, notificationDeliveries, notifications } from "@repo/database";

import { assertSuccess } from "../../../common/utils/fp-utils";
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

    const claimed = await repository.claimDue(25, LEASE_MS);

    assertSuccess(claimed);
    const stamped = await rowById(delivery.id);
    expect(claimed.value).toEqual([
      {
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
      },
    ]);
    expect(stamped).toMatchObject({ status: "sending" });
    // Stamped by the database, not the caller, so pin that it was set and is recent.
    expect(stamped.claimedAt).toBeInstanceOf(Date);
    expect(Math.abs(Number(stamped.claimedAt) - now.getTime())).toBeLessThan(30_000);
  });

  it("leaves a row that is not due yet", async () => {
    await seedDelivery({ nextAttemptAt: new Date(Date.now() + 10 * MINUTE) });

    const claimed = await repository.claimDue(25, LEASE_MS);

    assertSuccess(claimed);
    expect(claimed.value).toEqual([]);
  });

  it("takes the oldest due rows first, and never more than the limit", async () => {
    const now = new Date();
    // Six due rows for a batch of two: enough that a claim which re-ran its due
    // query per joined row would visibly walk past the batch it asked for.
    const seeded: Awaited<ReturnType<typeof seedDelivery>>[] = [];
    for (let minutes = 6; minutes >= 1; minutes -= 1) {
      seeded.push(
        await seedDelivery({ nextAttemptAt: new Date(now.getTime() - minutes * MINUTE) }),
      );
    }

    const claimed = await repository.claimDue(2, LEASE_MS);

    assertSuccess(claimed);
    expect(claimed.value).toHaveLength(2);
    expect(claimed.value.map((row) => row.id).sort()).toEqual(
      seeded
        .slice(0, 2)
        .map(({ delivery }) => delivery.id)
        .sort(),
    );
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

    const claimed = await repository.claimDue(25, LEASE_MS);

    assertSuccess(claimed);
    expect(claimed.value.map((row) => row.id)).toEqual([abandoned.delivery.id]);
    // Taking a claim back counts the attempt nobody finished, so a row that is
    // abandoned every time still runs out of attempts instead of looping forever.
    expect(claimed.value[0].attempts).toBe(1);
    expect(await rowById(abandoned.delivery.id)).toMatchObject({ attempts: 1 });
    // The fresh claim is untouched, count included.
    expect(await rowById(inFlight.delivery.id)).toMatchObject({
      claimedAt: new Date(now.getTime() - MINUTE),
      attempts: 0,
    });
  });

  it("leaves the count alone on a row claimed while pending", async () => {
    const { delivery } = await seedDelivery({ attempts: 2 });

    const claimed = await repository.claimDue(25, LEASE_MS);

    assertSuccess(claimed);
    expect(claimed.value[0].attempts).toBe(2);
    expect(await rowById(delivery.id)).toMatchObject({ attempts: 2 });
  });

  describe("fencing an outcome on the claim it belongs to", () => {
    it("writes when the claim is still held", async () => {
      await seedDelivery();
      const claimed = await repository.claimDue(1, LEASE_MS);
      assertSuccess(claimed);
      const claim = claimed.value[0];

      const marked = await repository.markSent(claim, new Date());

      assertSuccess(marked);
      expect(marked.value).toBe(true);
      expect(await rowById(claim.id)).toMatchObject({ status: "sent", claimedAt: null });
    });

    it("writes nothing when the row has been reclaimed since", async () => {
      await seedDelivery();
      const first = await repository.claimDue(1, LEASE_MS);
      assertSuccess(first);
      const stale = first.value[0];

      // The lease hands the row to another task, which is what a stalled sender wakes
      // up to find; its claim stamp is no longer the one on the row.
      await setDelivery(stale.id, { claimedAt: new Date(Date.now() - 6 * MINUTE) });
      const second = await repository.claimDue(1, LEASE_MS);
      assertSuccess(second);
      const held = second.value[0];
      assertSuccess(await repository.markSent(held, new Date()));

      const late = await repository.markRetry(stale, {
        attempts: 1,
        nextAttemptAt: new Date(Date.now() + MINUTE),
        lastError: "a stalled task catching up",
      });

      // The row keeps the state its real owner left it in, so the email goes out once.
      assertSuccess(late);
      expect(await rowById(stale.id)).toMatchObject({ status: "sent", attempts: 1 });
      expect(late.value).toBe(false);
    });

    it("writes nothing when the row is no longer sending", async () => {
      await seedDelivery();
      const claimed = await repository.claimDue(1, LEASE_MS);
      assertSuccess(claimed);
      const claim = claimed.value[0];
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
        repository.claimDue(25, LEASE_MS),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("claimDue waited for a row another task held")), 2_000),
        ),
      ]).finally(release);
      await holding;

      assertSuccess(claimed);
      expect(claimed.value.map((row) => row.id)).toEqual([free.delivery.id]);
      expect(await rowById(held.delivery.id)).toMatchObject({ status: "pending" });
    } finally {
      await blocker.close();
    }
  });

  it("hands two tasks claiming at once disjoint batches", async () => {
    const seeded = await Promise.all(Array.from({ length: 20 }, () => seedDelivery()));
    const secondary = createSecondaryDatabase();

    try {
      const otherTask = new NotificationDeliveryRepository(secondary.database);

      const [first, second] = await Promise.all([
        repository.claimDue(10, LEASE_MS),
        otherTask.claimDue(10, LEASE_MS),
      ]);

      assertSuccess(first);
      assertSuccess(second);
      const firstIds = first.value.map((row) => row.id);
      const secondIds = second.value.map((row) => row.id);
      expect(firstIds.filter((id) => secondIds.includes(id))).toEqual([]);
      expect([...firstIds, ...secondIds].sort()).toEqual(
        seeded.map(({ delivery }) => delivery.id).sort(),
      );
    } finally {
      await secondary.close();
    }
  });
});
