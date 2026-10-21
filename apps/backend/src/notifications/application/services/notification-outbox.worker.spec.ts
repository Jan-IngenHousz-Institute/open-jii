import { SchedulerRegistry } from "@nestjs/schedule";
import type { MockInstance } from "vitest";

import {
  sql as sqlRaw,
  createSecondaryDatabase,
  eq,
  notificationDeliveries,
  notifications,
  profiles,
  users,
} from "@repo/database";

import { EmailAdapter } from "../../../common/modules/email/services/email.adapter";
import { ErrorCodes } from "../../../common/utils/error-codes";
import { AppError, assertSuccess, failure, success } from "../../../common/utils/fp-utils";
import { claimedRow } from "../../../test/notification-deliveries";
import { TestHarness } from "../../../test/test-harness";
import { GUEST_DIRECTORY_PORT } from "../../../users/core/ports/guest-directory.port";
import { NotificationDeliveryRepository } from "../../core/repositories/notification-delivery.repository";
import { NotificationRepository } from "../../core/repositories/notification.repository";
import { NotificationDispatchService } from "./notification-dispatch.service";
import { NotificationEmailService } from "./notification-email.service";
import { LEASE_MS, NotificationOutboxWorker, OUTBOX_INTERVAL } from "./notification-outbox.worker";

const MINUTE = 60_000;

const IMPATIENT_DEADLINE_MS = 50;

/** The worker with a deadline a spec can wait out, so an attempt that hangs can be seen. */
class ImpatientWorker extends NotificationOutboxWorker {
  protected override readonly attemptDeadlineMs = IMPATIENT_DEADLINE_MS;
}

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

  it.each(["actor", "recipient"])(
    "skips a previously queued email when its %s is now a guest",
    async (side) => {
      await queueOne();
      await testApp.database
        .update(users)
        .set({ isAnonymous: true })
        .where(eq(users.id, side === "actor" ? actorId : recipientId));
      const result = await worker.drain();
      expect(result.skipped).toBe(1);
      expect(sendSubmitted).not.toHaveBeenCalled();
    },
  );

  const deliveryRows = () => testApp.database.select().from(notificationDeliveries);

  /**
   * How far out a row is due, measured by the clock that set it. `next_attempt_at` is
   * written by the database and compared against the database, so a task clock offset
   * from it would make this read wrong in a way production never sees.
   */
  const dueInMs = async (id: string) => {
    const [row] = await testApp.database.execute<{ ms: string }>(
      sqlRaw`SELECT (extract(epoch from ${notificationDeliveries.nextAttemptAt} - (now() AT TIME ZONE 'UTC')) * 1000)::bigint::text AS ms
             FROM ${notificationDeliveries}
             WHERE ${notificationDeliveries.id} = ${id}`,
    );
    return Number(row.ms);
  };

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

    expect(counts).toEqual({ sent: 1, retried: 0, deferred: 0, skipped: 0, failed: 0 });
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
    const counts = await worker.drain();

    expect(counts).toEqual({ sent: 0, retried: 1, deferred: 0, skipped: 0, failed: 0 });
    const row = await deliveryById(queued.id);
    expect(row).toMatchObject({ status: "pending", attempts: 1, claimedAt: null, sentAt: null });
    expect(row.lastError).toContain("Mail server refused");
    // A minute out, give or take however long the drain itself took.
    const dueIn = await dueInMs(queued.id);
    expect(dueIn).toBeGreaterThan(MINUTE - 30_000);
    expect(dueIn).toBeLessThanOrEqual(MINUTE);

    // The bell row is untouched whatever the mail server does.
    expect(await testApp.database.select().from(notifications)).toHaveLength(1);
  });

  it("gives up on the fifth failure", async () => {
    const queued = await queueOne();
    await setDelivery(queued.id, { attempts: 4 });
    sendSubmitted.mockResolvedValue(failure(AppError.internal("Mail server refused")));

    const counts = await worker.drain();

    expect(counts).toEqual({ sent: 0, retried: 0, deferred: 0, skipped: 0, failed: 1 });
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

    expect(await worker.drain()).toEqual({
      sent: 1,
      retried: 0,
      deferred: 0,
      skipped: 0,
      failed: 0,
    });
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

    expect(await worker.drain()).toEqual({
      sent: 0,
      retried: 0,
      deferred: 0,
      skipped: 0,
      failed: 1,
    });
    expect(await deliveryById(stuck.id)).toMatchObject({
      status: "failed",
      attempts: 6,
      lastError: "Gave up after 5 attempts",
    });
    expect(sendSubmitted).not.toHaveBeenCalled();
  });

  it("leaves a claim a minute old to the task that holds it", async () => {
    const inFlight = await queueOne();
    await setDelivery(inFlight.id, {
      status: "sending",
      claimedAt: new Date(Date.now() - MINUTE),
    });

    expect(await worker.drain()).toEqual({
      sent: 0,
      retried: 0,
      deferred: 0,
      skipped: 0,
      failed: 0,
    });
    expect(await deliveryById(inFlight.id)).toMatchObject({ status: "sending" });
    expect(sendSubmitted).not.toHaveBeenCalled();
  });

  it("skips a recipient deactivated after dispatch without calling the adapter", async () => {
    const queued = await queueOne();
    await testApp.database
      .update(profiles)
      .set({ activated: false })
      .where(eq(profiles.userId, recipientId));

    const counts = await worker.drain();

    expect(counts).toEqual({ sent: 0, retried: 0, deferred: 0, skipped: 1, failed: 0 });
    expect(await deliveryById(queued.id)).toMatchObject({
      // Set aside rather than failed: nobody could have received it, and waiting
      // will not make a deactivated recipient deliverable.
      status: "skipped",
      attempts: 1,
      lastError: "Recipient has no deliverable email address",
    });
    expect(sendSubmitted).not.toHaveBeenCalled();
  });

  it("skips a recipient whose account was closed after dispatch, without calling the adapter", async () => {
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

    expect(await worker.drain()).toEqual({
      sent: 0,
      retried: 0,
      deferred: 0,
      skipped: 1,
      failed: 0,
    });
    expect(await deliveryById(queued.id)).toMatchObject({
      status: "skipped",
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
    expect(await worker.drain()).toEqual({
      sent: 0,
      retried: 1,
      deferred: 0,
      skipped: 0,
      failed: 0,
    });

    const row = await deliveryById(queued.id);
    expect(row).toMatchObject({ status: "pending", attempts: 1, claimedAt: null });
    expect(row.lastError).toBe("Unknown notification type a_type_from_a_newer_deploy");
    // A minute out, so the task that does know the type gets its turn.
    expect(await dueInMs(queued.id)).toBeGreaterThan(MINUTE - 30_000);
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
    expect(await worker.drain()).toEqual({
      sent: 0,
      retried: 1,
      deferred: 0,
      skipped: 0,
      failed: 0,
    });

    const row = await deliveryById(queued.id);
    expect(row).toMatchObject({ status: "pending", attempts: 1, claimedAt: null });
    expect(row.lastError).toBe("Stored params do not match the type's schema");
    expect(await dueInMs(queued.id)).toBeGreaterThan(MINUTE - 30_000);
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
    expect(await worker.drain()).toEqual({
      sent: 0,
      retried: 1,
      deferred: 0,
      skipped: 0,
      failed: 0,
    });

    const row = await deliveryById(queued.id);
    expect(row).toMatchObject({ status: "pending", attempts: 1, claimedAt: null });
    expect(row.lastError).toBe("No email for notification type data_export_completed");
    expect(await dueInMs(queued.id)).toBeGreaterThan(MINUTE - 30_000);
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
        testApp.module.get(GUEST_DIRECTORY_PORT),
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

    expect(first).toEqual({ sent: 1, retried: 0, deferred: 0, skipped: 0, failed: 0 });
    expect(reentrant.counts).toEqual({ sent: 0, retried: 0, deferred: 0, skipped: 0, failed: 0 });
    // The re-entrant drain never reached the database: one claim that found the row,
    // one that found nothing, and nothing at all from the second call.
    expect(claim).toHaveBeenCalledTimes(2);
  });

  describe("the paths that only fail", () => {
    it("drains on the interval and on a nudge", async () => {
      // The harness hands every spec the quiet subclass, so the real entry points are
      // exercised on an instance built here. A hand-built one registers no interval,
      // so nothing it does leaks into the rest of the suite.
      const real = new NotificationOutboxWorker(
        deliveryRepository,
        testApp.module.get(NotificationRepository),
        testApp.module.get(NotificationEmailService),
        testApp.module.get(GUEST_DIRECTORY_PORT),
      );
      const drain = vi
        .spyOn(real, "drain")
        .mockResolvedValue({ sent: 0, retried: 0, deferred: 0, skipped: 0, failed: 0 });

      await real.drainOnSchedule();
      expect(drain).toHaveBeenCalledTimes(1);

      real.nudge();
      expect(drain).toHaveBeenCalledTimes(2);
    });

    it("stops the drain when the claim itself fails", async () => {
      await queueOne();
      vi.spyOn(deliveryRepository, "claimDue").mockResolvedValue(
        failure(AppError.internal("Database unavailable")),
      );

      expect(await worker.drain()).toEqual({
        sent: 0,
        retried: 0,
        deferred: 0,
        skipped: 0,
        failed: 0,
      });
      expect(sendSubmitted).not.toHaveBeenCalled();
    });

    it("clears the flag when the claim throws, so the next drain still runs", async () => {
      const queued = await queueOne();
      vi.spyOn(deliveryRepository, "claimDue").mockRejectedValueOnce(
        new Error("connection terminated"),
      );

      expect(await worker.drain()).toEqual({
        sent: 0,
        retried: 0,
        deferred: 0,
        skipped: 0,
        failed: 0,
      });

      // The `finally` ran, so the worker is not wedged: the row goes out next time.
      expect(await worker.drain()).toEqual({
        sent: 1,
        retried: 0,
        deferred: 0,
        skipped: 0,
        failed: 0,
      });
      expect(await deliveryById(queued.id)).toMatchObject({ status: "sent" });
    });

    it("treats a thrown send as that attempt failing, not as the drain failing", async () => {
      const queued = await queueOne();
      vi.spyOn(testApp.module.get(NotificationEmailService), "send").mockRejectedValue(
        new Error("transport exploded"),
      );

      expect(await worker.drain()).toEqual({
        sent: 0,
        retried: 1,
        deferred: 0,
        skipped: 0,
        failed: 0,
      });
      expect(await deliveryById(queued.id)).toMatchObject({
        status: "pending",
        attempts: 1,
        lastError: "transport exploded",
      });
    });

    it("retries when the recipient cannot be looked up", async () => {
      const queued = await queueOne();
      vi.spyOn(testApp.module.get(NotificationRepository), "findUsers").mockResolvedValue(
        failure(AppError.internal("Database unavailable")),
      );

      expect(await worker.drain()).toEqual({
        sent: 0,
        retried: 1,
        deferred: 0,
        skipped: 0,
        failed: 0,
      });
      expect(await deliveryById(queued.id)).toMatchObject({
        status: "pending",
        attempts: 1,
        lastError: "Database unavailable",
      });
      expect(sendSubmitted).not.toHaveBeenCalled();
    });

    it("gives up on an attempt that outlasts its deadline", async () => {
      const queued = await queueOne();
      // A send that never settles: the socket is up and the far end says nothing.
      vi.spyOn(testApp.module.get(NotificationEmailService), "send").mockReturnValue(
        new Promise(() => undefined),
      );

      // A deadline this spec can wait for; the real one is three minutes.
      const impatient = new ImpatientWorker(
        deliveryRepository,
        testApp.module.get(NotificationRepository),
        testApp.module.get(NotificationEmailService),
        testApp.module.get(GUEST_DIRECTORY_PORT),
      );

      expect(await impatient.drain()).toEqual({
        sent: 0,
        retried: 1,
        deferred: 0,
        skipped: 0,
        failed: 0,
      });
      expect(await deliveryById(queued.id)).toMatchObject({
        status: "pending",
        attempts: 1,
        lastError: `Attempt exceeded ${IMPATIENT_DEADLINE_MS / 1000} s`,
      });
    });

    it("claims nothing new once the task is shutting down, and waits for the attempt in flight", async () => {
      const first = await queueOne();
      await queueOne(await testApp.createTestUser({ email: "second@example.com" }));
      const stopped: { promise?: Promise<void> } = {};
      // Its own instance: `stopping` is one-way, as it is in a task that is going away.
      const stoppingWorker = new NotificationOutboxWorker(
        deliveryRepository,
        testApp.module.get(NotificationRepository),
        testApp.module.get(NotificationEmailService),
        testApp.module.get(GUEST_DIRECTORY_PORT),
      );

      // Shutdown is called while the first row is mid-send, as a signal would.
      sendSubmitted.mockImplementationOnce(() => {
        stopped.promise = stoppingWorker.onApplicationShutdown();
        return Promise.resolve(success(undefined));
      });

      const counts = await stoppingWorker.drain();
      await stopped.promise;

      // The row in flight was seen through to its outcome; the other was left queued.
      expect(counts).toEqual({ sent: 1, retried: 0, deferred: 0, skipped: 0, failed: 0 });
      expect(await deliveryById(first.id)).toMatchObject({ status: "sent" });
      expect((await deliveryRows()).filter((row) => row.status === "pending")).toHaveLength(1);
    });

    /** What the adapter hands back when our relay could not be reached at all. */
    const relayDown = () =>
      failure(
        AppError.internal(
          "Failed to send email: connect ECONNREFUSED 127.0.0.1:1025",
          ErrorCodes.EMAIL_RELAY_UNREACHABLE,
        ),
      );

    it("waits out an unreachable relay without spending an attempt", async () => {
      const queued = await queueOne();
      sendSubmitted.mockResolvedValue(relayDown());

      expect(await worker.drain()).toEqual({
        sent: 0,
        retried: 0,
        deferred: 1,
        skipped: 0,
        failed: 0,
      });
      const row = await deliveryById(queued.id);
      expect(row).toMatchObject({
        status: "pending",
        attempts: 0,
        claimedAt: null,
        lastError: "Failed to send email: connect ECONNREFUSED 127.0.0.1:1025",
      });
      // Five minutes out, by the clock that will decide when it is due.
      const dueIn = await dueInMs(queued.id);
      expect(dueIn).toBeGreaterThan(5 * MINUTE - 30_000);
      expect(dueIn).toBeLessThanOrEqual(5 * MINUTE);
    });

    it("does not let an outage push a row on its last attempt into failed", async () => {
      const queued = await queueOne();
      await setDelivery(queued.id, { attempts: 4 });
      sendSubmitted.mockResolvedValue(relayDown());

      expect(await worker.drain()).toEqual({
        sent: 0,
        retried: 0,
        deferred: 1,
        skipped: 0,
        failed: 0,
      });
      // Still one try left: the relay being down said nothing about this email.
      expect(await deliveryById(queued.id)).toMatchObject({ status: "pending", attempts: 4 });
    });

    it("stops claiming after three unreachable sends in a row, and picks up again next time", async () => {
      const queued = [await queueOne()];
      for (let index = 0; index < 3; index += 1) {
        queued.push(
          await queueOne(await testApp.createTestUser({ email: `relay-${index}@example.com` })),
        );
      }
      sendSubmitted.mockResolvedValue(relayDown());

      expect(await worker.drain()).toEqual({
        sent: 0,
        retried: 0,
        deferred: 3,
        skipped: 0,
        failed: 0,
      });
      // The fourth was never claimed: no attempt, no claim, still due now.
      const untouched = (await deliveryRows()).filter(
        (row) => row.status === "pending" && row.lastError === null,
      );
      expect(untouched).toHaveLength(1);
      expect(untouched[0]).toMatchObject({ attempts: 0, claimedAt: null });

      // The relay is back; the next drain finds the one left and sends it.
      sendSubmitted.mockResolvedValue(success(undefined));
      expect(await worker.drain()).toEqual({
        sent: 1,
        retried: 0,
        deferred: 0,
        skipped: 0,
        failed: 0,
      });
      expect(await deliveryById(untouched[0].id)).toMatchObject({ status: "sent" });
    });

    it("counts a send whose row could not be marked sent, and leaves it to the lease", async () => {
      const queued = await queueOne();
      vi.spyOn(deliveryRepository, "markSent").mockResolvedValue(
        failure(AppError.internal("Database unavailable")),
      );

      // The email did go out, so the count is honest; the row is still `sending` and
      // the lease will offer it again, which is the at-least-once trade an outbox makes.
      expect(await worker.drain()).toEqual({
        sent: 1,
        retried: 0,
        deferred: 0,
        skipped: 0,
        failed: 0,
      });
      expect(sendSubmitted).toHaveBeenCalledTimes(1);
      expect(await deliveryById(queued.id)).toMatchObject({ status: "sending" });
    });

    it("does not undo a send another task made while this one was stalled", async () => {
      const queued = await queueOne();
      // This task claims the row, then stalls long enough for the lease to hand it on.
      const claimed = await deliveryRepository.claimDue(LEASE_MS);
      assertSuccess(claimed);
      const stale = claimedRow(claimed.value);

      await setDelivery(stale.id, { claimedAt: new Date(Date.now() - 6 * MINUTE) });
      expect(await worker.drain()).toEqual({
        sent: 1,
        retried: 0,
        deferred: 0,
        skipped: 0,
        failed: 0,
      });

      // The stalled task finally comes back and records the failure it saw.
      const late = await deliveryRepository.markRetry(stale, {
        attempts: 1,
        delayMs: MINUTE,
        lastError: "Mail server refused",
      });

      // Without the fence this row would read `pending` again and be sent twice.
      assertSuccess(late);
      expect(await deliveryById(queued.id)).toMatchObject({ status: "sent" });
      expect(sendSubmitted).toHaveBeenCalledTimes(1);
      expect(late.value).toBe(false);
    });

    it("counts a retry whose row could not be marked", async () => {
      await queueOne();
      sendSubmitted.mockResolvedValue(failure(AppError.internal("Mail server refused")));
      vi.spyOn(deliveryRepository, "markRetry").mockResolvedValue(
        failure(AppError.internal("Database unavailable")),
      );

      expect(await worker.drain()).toEqual({
        sent: 0,
        retried: 1,
        deferred: 0,
        skipped: 0,
        failed: 0,
      });
    });

    it("counts a failure whose row could not be marked", async () => {
      const queued = await queueOne();
      await setDelivery(queued.id, { attempts: 4 });
      sendSubmitted.mockResolvedValue(failure(AppError.internal("Mail server refused")));
      vi.spyOn(deliveryRepository, "markFailed").mockResolvedValue(
        failure(AppError.internal("Database unavailable")),
      );

      expect(await worker.drain()).toEqual({
        sent: 0,
        retried: 0,
        deferred: 0,
        skipped: 0,
        failed: 1,
      });
    });

    it("counts a skip whose row could not be marked", async () => {
      await queueOne();
      await testApp.database
        .update(profiles)
        .set({ activated: false })
        .where(eq(profiles.userId, recipientId));
      vi.spyOn(deliveryRepository, "markSkipped").mockResolvedValue(
        failure(AppError.internal("Database unavailable")),
      );

      expect(await worker.drain()).toEqual({
        sent: 0,
        retried: 0,
        deferred: 0,
        skipped: 1,
        failed: 0,
      });
      expect(sendSubmitted).not.toHaveBeenCalled();
    });
  });

  it("looks once more when a nudge lands during the last claim", async () => {
    const claim = vi.spyOn(deliveryRepository, "claimDue");
    // A real worker: the one the harness hands out has its nudge silenced.
    const nudgeable = new NotificationOutboxWorker(
      deliveryRepository,
      testApp.module.get(NotificationRepository),
      testApp.module.get(NotificationEmailService),
      testApp.module.get(GUEST_DIRECTORY_PORT),
    );

    // Nothing is queued, so the first claim comes back empty; the nudge arriving in
    // that moment is the row a producer queued just after it was looked for.
    const drained = nudgeable.drain();
    nudgeable.nudge();

    expect(await drained).toEqual({ sent: 0, retried: 0, deferred: 0, skipped: 0, failed: 0 });
    expect(claim.mock.calls.length).toBeGreaterThanOrEqual(2);
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
