import { Logger } from "@nestjs/common";
import { SchedulerRegistry } from "@nestjs/schedule";
import { vi } from "vitest";

import {
  createSecondaryDatabase,
  eq,
  inArray,
  notificationDeliveries,
  notifications,
  sql,
} from "@repo/database";

import { AppError, assertSuccess, failure } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { ANALYTICS_PORT } from "../../core/ports/analytics.port";
import type { AnalyticsPort } from "../../core/ports/analytics.port";
import {
  NOTIFICATION_RETENTION_LOCK_KEY,
  NotificationRepository,
} from "../../core/repositories/notification.repository";
import {
  READ_RETENTION_DAYS,
  RETENTION_CRON,
  RETENTION_DAYS,
  NotificationRetentionService,
} from "./notification-retention.service";

const DAY = 24 * 60 * 60_000;
const RETENTION_LOCK = sql`hashtext(${NOTIFICATION_RETENTION_LOCK_KEY})`;

describe("NotificationRetentionService", () => {
  const testApp = TestHarness.App;
  let service: NotificationRetentionService;
  let repository: NotificationRepository;
  let recipientId: string;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    service = testApp.module.get(NotificationRetentionService);
    repository = testApp.module.get(NotificationRepository);
    recipientId = await testApp.createTestUser({ email: "recipient@example.com" });
    logSpy = vi.spyOn(Logger.prototype, "log").mockImplementation(() => {
      /* no-op */
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const daysAgo = (days: number) => new Date(Date.now() - days * DAY);

  /** One notification that arrived `ageDays` ago, read the same day or never, with one email owed. */
  async function seed(recipient: string, ageDays: number, read: boolean) {
    const createdAt = daysAgo(ageDays);
    const [notification] = await testApp.database
      .insert(notifications)
      .values({
        recipientId: recipient,
        type: "experiment_join_request_received",
        params: { experimentName: `${ageDays} days ${read ? "read" : "unread"}` },
        createdAt,
        readAt: read ? createdAt : null,
      })
      .returning();

    const [delivery] = await testApp.database
      .insert(notificationDeliveries)
      .values({ notificationId: notification.id, channel: "email" })
      .returning();

    return { notificationId: notification.id, deliveryId: delivery.id };
  }

  const remainingNotifications = async () =>
    (await testApp.database.select({ id: notifications.id }).from(notifications))
      .map((row) => row.id)
      .sort();

  const remainingDeliveries = async () =>
    (await testApp.database.select({ id: notificationDeliveries.id }).from(notificationDeliveries))
      .map((row) => row.id)
      .sort();

  const periods = (batchSize: number) => ({
    readAfterDays: READ_RETENTION_DAYS,
    allAfterDays: RETENTION_DAYS,
    batchSize,
  });

  /** Whether a session other than the task's can take the lock, released again at once. */
  async function lockIsFree(): Promise<boolean> {
    const other = createSecondaryDatabase();
    try {
      const [row] = await other.database.execute<{ locked: boolean }>(
        sql`SELECT pg_try_advisory_lock(${RETENTION_LOCK}) AS locked`,
      );
      if (row.locked) {
        await other.database.execute(sql`SELECT pg_advisory_unlock(${RETENTION_LOCK})`);
      }
      return row.locked;
    } finally {
      await other.close();
    }
  }

  it("removes read rows past 90 days and unread rows past a year, with their deliveries, for every recipient", async () => {
    const otherRecipientId = await testApp.createTestUser({ email: "other@example.com" });
    const kept: Awaited<ReturnType<typeof seed>>[] = [];
    const removed: Awaited<ReturnType<typeof seed>>[] = [];

    for (const recipient of [recipientId, otherRecipientId]) {
      kept.push(await seed(recipient, 89, true));
      removed.push(await seed(recipient, 91, true));
      kept.push(await seed(recipient, 364, false));
      removed.push(await seed(recipient, 366, false));
    }

    await service.run();

    expect(await remainingNotifications()).toEqual(kept.map((row) => row.notificationId).sort());
    expect(await remainingDeliveries()).toEqual(kept.map((row) => row.deliveryId).sort());
    const gone = await testApp.database
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        inArray(
          notifications.id,
          removed.map((row) => row.notificationId),
        ),
      );
    expect(gone).toEqual([]);
  });

  it("deletes in batches until a batch comes back short", async () => {
    for (let i = 0; i < 5; i++) {
      await seed(recipientId, 91, true);
    }

    await service.run(periods(2));

    expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({ deleted: 5, batches: 3 }));
    expect(await remainingNotifications()).toEqual([]);
    expect(await remainingDeliveries()).toEqual([]);
  });

  it("runs one empty batch when nothing has expired", async () => {
    const { notificationId } = await seed(recipientId, 89, true);

    await service.run();

    expect(logSpy).toHaveBeenCalledWith(expect.objectContaining({ deleted: 0, batches: 1 }));
    expect(await remainingNotifications()).toEqual([notificationId]);
  });

  it("skips the run while another session holds the lock, which holds only while the task's client is max: 1", async () => {
    const { notificationId } = await seed(recipientId, 91, true);
    const holder = createSecondaryDatabase();

    try {
      const [held] = await holder.database.execute<{ locked: boolean }>(
        sql`SELECT pg_try_advisory_lock(${RETENTION_LOCK}) AS locked`,
      );
      expect(held.locked).toBe(true);

      const attempt = await repository.tryRetentionLock();
      await service.run();

      assertSuccess(attempt);
      expect(attempt.value).toBe(false);
      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({ msg: expect.stringContaining("another task") as unknown }),
      );
      expect(await remainingNotifications()).toEqual([notificationId]);

      await holder.database.execute(sql`SELECT pg_advisory_unlock(${RETENTION_LOCK})`);
    } finally {
      await holder.close();
    }

    await service.run();

    expect(await remainingNotifications()).toEqual([]);
  });

  it("releases the lock after a run, so another task can take it and the next run deletes", async () => {
    await seed(recipientId, 91, true);
    const { notificationId } = await seed(recipientId, 10, true);

    await service.run();

    expect(await remainingNotifications()).toEqual([notificationId]);
    expect(await lockIsFree()).toBe(true);

    await testApp.database
      .update(notifications)
      .set({ createdAt: daysAgo(91) })
      .where(eq(notifications.id, notificationId));

    await service.run();

    expect(await remainingNotifications()).toEqual([]);
  });

  it("releases the lock when a batch fails, reports the delete, and the next run deletes", async () => {
    await seed(recipientId, 91, true);
    const reportError = vi
      .spyOn(testApp.module.get<AnalyticsPort>(ANALYTICS_PORT), "reportError")
      .mockImplementation(() => undefined);
    const batch = vi
      .spyOn(repository, "deleteExpiredBatch")
      .mockResolvedValueOnce(failure(AppError.repositoryError("connection reset")));

    await service.run();

    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(
      expect.any(AppError),
      expect.objectContaining({ stage: "delete" }),
    );
    expect(await lockIsFree()).toBe(true);

    batch.mockRestore();
    await service.run();

    expect(await remainingNotifications()).toEqual([]);
  });

  it("registers the daily schedule", () => {
    const registry = testApp.module.get(SchedulerRegistry);

    expect(registry.getCronJobs().has(RETENTION_CRON)).toBe(true);
  });
});
