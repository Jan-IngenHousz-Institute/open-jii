import { SchedulerRegistry } from "@nestjs/schedule";
import type { MockInstance } from "vitest";

import {
  createSecondaryDatabase,
  eq,
  notificationDeliveries,
  notifications,
  profiles,
  users,
} from "@repo/database";

import { EmailAdapter } from "../../../common/modules/email/services/email.adapter";
import { AppError, assertSuccess, failure, success } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { NotificationDeliveryRepository } from "../../core/repositories/notification-delivery.repository";
import { NotificationRepository } from "../../core/repositories/notification.repository";
import { NotificationDispatchService } from "./notification-dispatch.service";
import { NotificationEmailService } from "./notification-email.service";
import { NotificationOutboxWorker, OUTBOX_INTERVAL } from "./notification-outbox.worker";

const MINUTE = 60_000;

describe("NotificationOutboxWorker", () => {
  const testApp = TestHarness.App;
  let worker: NotificationOutboxWorker;
  let dispatch: NotificationDispatchService;
  let deliveryRepository: NotificationDeliveryRepository;
  let sendSubmitted: MockInstance<EmailAdapter["sendJoinRequestSubmittedNotification"]>;
  let actorId: string;
  let recipientId: string;
  const recipientEmail = "recipient@example.com";
  const experiment = { type: "experiment" as const, id: crypto.randomUUID() };

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();

    actorId = await testApp.createTestUser({ name: "Ada Lovelace" });
    recipientId = await testApp.createTestUser({ email: recipientEmail });

    worker = testApp.module.get(NotificationOutboxWorker);
    dispatch = testApp.module.get(NotificationDispatchService);
    deliveryRepository = testApp.module.get(NotificationDeliveryRepository);

    sendSubmitted = vi
      .spyOn(testApp.module.get(EmailAdapter), "sendJoinRequestSubmittedNotification")
      .mockResolvedValue(success(undefined));
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  /** Queue one email the way a producer does, so the row under test is the real thing. */
  async function queueOne(recipient = recipientId) {
    const queued = await dispatch.dispatch({
      type: "experiment_join_request_received",
      recipientIds: [recipient],
      actorId,
      resource: experiment,
      params: { experimentName: "Photosynthesis", message: "Please let me in" },
    });
    assertSuccess(queued);
    expect(queued.value.queued).toBe(1);

    const [row] = await testApp.database
      .select({
        id: notificationDeliveries.id,
        notificationId: notificationDeliveries.notificationId,
      })
      .from(notificationDeliveries)
      .innerJoin(notifications, eq(notifications.id, notificationDeliveries.notificationId))
      .where(eq(notifications.recipientId, recipient));

    return row;
  }

  const deliveryRows = () => testApp.database.select().from(notificationDeliveries);

  const deliveryById = async (id: string) => {
    const [row] = await testApp.database
      .select()
      .from(notificationDeliveries)
      .where(eq(notificationDeliveries.id, id));
    return row;
  };

  const setDelivery = (id: string, values: Partial<typeof notificationDeliveries.$inferInsert>) =>
    testApp.database
      .update(notificationDeliveries)
      .set(values)
      .where(eq(notificationDeliveries.id, id));

  it("sends a pending row with the context dispatch would have passed, and marks it sent", async () => {
    const queued = await queueOne();

    const counts = await worker.drain();

    expect(counts).toEqual({ sent: 1, retried: 0, failed: 0 });
    expect(sendSubmitted).toHaveBeenCalledExactlyOnceWith(
      experiment.id,
      "Photosynthesis",
      "Ada Lovelace",
      recipientEmail,
      "Please let me in",
    );

    const row = await deliveryById(queued.id);
    expect(row).toMatchObject({ status: "sent", attempts: 0, claimedAt: null });
    expect(row.sentAt).toBeInstanceOf(Date);
  });

  it("puts a row back to pending a minute out when the adapter fails", async () => {
    const queued = await queueOne();
    sendSubmitted.mockResolvedValue(failure(AppError.internal("Mail server refused")));
    const before = Date.now();

    const counts = await worker.drain();

    expect(counts).toEqual({ sent: 0, retried: 1, failed: 0 });
    const row = await deliveryById(queued.id);
    expect(row).toMatchObject({ status: "pending", attempts: 1, claimedAt: null, sentAt: null });
    expect(row.lastError).toContain("Mail server refused");
    // A minute out, give or take however long the drain itself took.
    expect(row.nextAttemptAt.getTime() - before).toBeGreaterThanOrEqual(MINUTE - 1_000);
    expect(row.nextAttemptAt.getTime() - before).toBeLessThan(MINUTE + 30_000);

    // The bell row is untouched whatever the mail server does.
    expect(await testApp.database.select().from(notifications)).toHaveLength(1);
  });

  it("gives up on the fifth failure", async () => {
    const queued = await queueOne();
    await setDelivery(queued.id, { attempts: 4 });
    sendSubmitted.mockResolvedValue(failure(AppError.internal("Mail server refused")));

    const counts = await worker.drain();

    expect(counts).toEqual({ sent: 0, retried: 0, failed: 1 });
    expect(await deliveryById(queued.id)).toMatchObject({
      status: "failed",
      attempts: 5,
      claimedAt: null,
    });
    expect(await testApp.database.select().from(notifications)).toHaveLength(1);
  });

  it("takes back a claim six minutes old", async () => {
    const abandoned = await queueOne();
    await setDelivery(abandoned.id, {
      status: "sending",
      claimedAt: new Date(Date.now() - 6 * MINUTE),
    });

    expect(await worker.drain()).toEqual({ sent: 1, retried: 0, failed: 0 });
    // The claim counted the attempt the task that died never finished.
    expect(await deliveryById(abandoned.id)).toMatchObject({ status: "sent", attempts: 1 });
  });

  it("gives up on a row abandoned five times, without calling the adapter", async () => {
    const stuck = await queueOne();
    // A task claimed it and died, five times over; the sixth claim finds the count spent.
    await setDelivery(stuck.id, {
      status: "sending",
      attempts: 5,
      claimedAt: new Date(Date.now() - 6 * MINUTE),
    });

    expect(await worker.drain()).toEqual({ sent: 0, retried: 0, failed: 1 });
    expect(await deliveryById(stuck.id)).toMatchObject({
      status: "failed",
      attempts: 6,
      lastError: "Abandoned 5 times",
    });
    expect(sendSubmitted).not.toHaveBeenCalled();
  });

  it("leaves a claim a minute old to the task that holds it", async () => {
    const inFlight = await queueOne();
    await setDelivery(inFlight.id, {
      status: "sending",
      claimedAt: new Date(Date.now() - MINUTE),
    });

    expect(await worker.drain()).toEqual({ sent: 0, retried: 0, failed: 0 });
    expect(await deliveryById(inFlight.id)).toMatchObject({ status: "sending" });
    expect(sendSubmitted).not.toHaveBeenCalled();
  });

  it("fails a recipient deactivated after dispatch without calling the adapter", async () => {
    const queued = await queueOne();
    await testApp.database
      .update(profiles)
      .set({ activated: false })
      .where(eq(profiles.userId, recipientId));

    const counts = await worker.drain();

    expect(counts).toEqual({ sent: 0, retried: 0, failed: 1 });
    expect(await deliveryById(queued.id)).toMatchObject({
      status: "failed",
      // Permanent: waiting will not make a deactivated recipient deliverable.
      attempts: 1,
      lastError: "Recipient has no deliverable email address",
    });
    expect(sendSubmitted).not.toHaveBeenCalled();
  });

  it("fails a recipient whose account was closed after dispatch, without calling the adapter", async () => {
    const queued = await queueOne();
    // What account deletion really writes: `deleted_at` set, the address rewritten to a
    // stand-in that passes a syntax check, and `activated` left alone.
    await testApp.database
      .update(profiles)
      .set({ deletedAt: new Date() })
      .where(eq(profiles.userId, recipientId));
    await testApp.database
      .update(users)
      .set({ email: `deleted-${recipientId}@example.com` })
      .where(eq(users.id, recipientId));

    expect(await worker.drain()).toEqual({ sent: 0, retried: 0, failed: 1 });
    expect(await deliveryById(queued.id)).toMatchObject({
      status: "failed",
      attempts: 1,
      lastError: "Recipient has no deliverable email address",
    });
    expect(sendSubmitted).not.toHaveBeenCalled();
  });

  it("retries a type this build does not know, without calling the adapter", async () => {
    const queued = await queueOne();
    // What a rolling deploy looks like from the old task: a type the newer build
    // dispatched and this one has never heard of.
    await testApp.database
      .update(notifications)
      .set({ type: "a_type_from_a_newer_deploy" })
      .where(eq(notifications.id, queued.notificationId));
    const before = Date.now();

    expect(await worker.drain()).toEqual({ sent: 0, retried: 1, failed: 0 });

    const row = await deliveryById(queued.id);
    expect(row).toMatchObject({ status: "pending", attempts: 1, claimedAt: null });
    expect(row.lastError).toBe("Unknown notification type a_type_from_a_newer_deploy");
    // A minute out, so the task that does know the type gets its turn.
    expect(row.nextAttemptAt.getTime() - before).toBeGreaterThanOrEqual(MINUTE - 1_000);
    expect(row.nextAttemptAt.getTime() - before).toBeLessThan(MINUTE + 30_000);
    expect(sendSubmitted).not.toHaveBeenCalled();
  });

  it("retries params this build's schema rejects, without calling the adapter", async () => {
    const queued = await queueOne();
    // The third shape of the same deploy window: a newer build renamed or dropped a
    // param, so the row this build claims no longer satisfies the schema it knows.
    await testApp.database
      .update(notifications)
      .set({ params: {} })
      .where(eq(notifications.id, queued.notificationId));
    const before = Date.now();

    expect(await worker.drain()).toEqual({ sent: 0, retried: 1, failed: 0 });

    const row = await deliveryById(queued.id);
    expect(row).toMatchObject({ status: "pending", attempts: 1, claimedAt: null });
    expect(row.lastError).toBe("Stored params do not match the type's schema");
    expect(row.nextAttemptAt.getTime() - before).toBeGreaterThanOrEqual(MINUTE - 1_000);
    expect(sendSubmitted).not.toHaveBeenCalled();
  });

  it("retries a known type whose email entry this build lacks", async () => {
    const queued = await queueOne();
    // `data_export_completed` is a real type with no entry in the email registry yet,
    // which is the other half of the same deploy window.
    await testApp.database
      .update(notifications)
      .set({ type: "data_export_completed" })
      .where(eq(notifications.id, queued.notificationId));
    const before = Date.now();

    expect(await worker.drain()).toEqual({ sent: 0, retried: 1, failed: 0 });

    const row = await deliveryById(queued.id);
    expect(row).toMatchObject({ status: "pending", attempts: 1, claimedAt: null });
    expect(row.lastError).toBe("No email for notification type data_export_completed");
    expect(row.nextAttemptAt.getTime() - before).toBeGreaterThanOrEqual(MINUTE - 1_000);
    expect(row.nextAttemptAt.getTime() - before).toBeLessThan(MINUTE + 30_000);
    expect(sendSubmitted).not.toHaveBeenCalled();
  });

  it("sends each of twenty rows exactly once across two tasks draining together", async () => {
    for (let index = 0; index < 20; index += 1) {
      await queueOne(await testApp.createTestUser({ email: `person-${index}@example.com` }));
    }

    // A second instance on its own connection is what a second task is: the
    // `draining` flag is per process, so only the claim keeps the two apart.
    const secondary = createSecondaryDatabase();

    try {
      const otherTask = new NotificationOutboxWorker(
        new NotificationDeliveryRepository(secondary.database),
        testApp.module.get(NotificationRepository),
        testApp.module.get(NotificationEmailService),
      );

      const [first, second] = await Promise.all([worker.drain(), otherTask.drain()]);

      expect(first.sent + second.sent).toBe(20);
      expect(sendSubmitted).toHaveBeenCalledTimes(20);
      const addresses = sendSubmitted.mock.calls.map((call) => call[3]);
      expect(new Set(addresses).size).toBe(20);
      expect((await deliveryRows()).every((row) => row.status === "sent")).toBe(true);
    } finally {
      await secondary.close();
    }
  });

  it("returns zeros from a second drain while the first is still running", async () => {
    await queueOne();
    const claim = vi.spyOn(deliveryRepository, "claimDue");
    const reentrant: { counts?: Awaited<ReturnType<NotificationOutboxWorker["drain"]>> } = {};

    sendSubmitted.mockImplementationOnce(async () => {
      reentrant.counts = await worker.drain();
      return success(undefined);
    });

    const first = await worker.drain();

    expect(first).toEqual({ sent: 1, retried: 0, failed: 0 });
    expect(reentrant.counts).toEqual({ sent: 0, retried: 0, failed: 0 });
    // The re-entrant drain never reached the database: one claim for the batch, one
    // that came back empty, and nothing from the second call.
    expect(claim).toHaveBeenCalledTimes(2);
  });

  it("leaves no outbox interval on the schedule under the harness", async () => {
    await queueOne();
    const scheduler = testApp.module.get(SchedulerRegistry);

    // The whole app is booted here, so an interval left registered would drain rows
    // every fifteen seconds while other specs were asserting on them.
    expect([...scheduler.getIntervals()]).not.toContain(OUTBOX_INTERVAL);

    // And the two entry points are inert, so a producer calling nudge() costs nothing.
    await worker.drainOnSchedule();
    worker.nudge();

    expect(await deliveryRows()).toMatchObject([{ status: "pending" }]);
    expect(sendSubmitted).not.toHaveBeenCalled();
  });
});
