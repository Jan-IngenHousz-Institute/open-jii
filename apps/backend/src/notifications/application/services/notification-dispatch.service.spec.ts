import { Logger } from "@nestjs/common";
import type { MockInstance } from "vitest";

import type { NotificationParams } from "@repo/api/domains/notification/notification.schema";
import { createSecondaryDatabase, eq, notifications, sql } from "@repo/database";
import type { DatabaseInstance } from "@repo/database";

import { EmailAdapter } from "../../../common/modules/email/services/email.adapter";
import { ErrorCodes } from "../../../common/utils/error-codes";
import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../common/utils/fp-utils";
import { queuedDeliveriesFor } from "../../../test/notification-deliveries";
import { TestHarness } from "../../../test/test-harness";
import { NotificationDeliveryRepository } from "../../core/repositories/notification-delivery.repository";
import { NotificationRepository } from "../../core/repositories/notification.repository";
import { NotificationDispatchService } from "./notification-dispatch.service";
import { NotificationEmailService } from "./notification-email.service";
import { NotificationOutboxWorker } from "./notification-outbox.worker";
import { NotificationPreferencesService } from "./notification-preferences.service";

describe("NotificationDispatchService", () => {
  const testApp = TestHarness.App;
  let dispatch: NotificationDispatchService;
  let repository: NotificationRepository;
  let deliveryRepository: NotificationDeliveryRepository;
  let notificationEmail: NotificationEmailService;
  let sendSubmitted: MockInstance<EmailAdapter["sendJoinRequestSubmittedNotification"]>;
  let sendAccessGranted: MockInstance<EmailAdapter["sendAccessGrantedNotification"]>;
  let sendRejected: MockInstance<EmailAdapter["sendJoinRequestRejectedNotification"]>;
  let actorId: string;
  let recipientId: string;
  let recipientEmail: string;
  const experiment = { type: "experiment" as const, id: crypto.randomUUID() };

  const rowsFor = (userId: string) =>
    testApp.database.select().from(notifications).where(eq(notifications.recipientId, userId));

  const deliveriesFor = (userId: string) => queuedDeliveriesFor(testApp.database, userId);

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();

    recipientEmail = "recipient@example.com";
    actorId = await testApp.createTestUser({ name: "Ada Lovelace" });
    recipientId = await testApp.createTestUser({ email: recipientEmail });

    dispatch = testApp.module.get(NotificationDispatchService);
    repository = testApp.module.get(NotificationRepository);
    deliveryRepository = testApp.module.get(NotificationDeliveryRepository);
    notificationEmail = testApp.module.get(NotificationEmailService);

    const emailAdapter = testApp.module.get(EmailAdapter);
    sendSubmitted = vi
      .spyOn(emailAdapter, "sendJoinRequestSubmittedNotification")
      .mockResolvedValue(success(undefined));
    sendAccessGranted = vi
      .spyOn(emailAdapter, "sendAccessGrantedNotification")
      .mockResolvedValue(success(undefined));
    sendRejected = vi
      .spyOn(emailAdapter, "sendJoinRequestRejectedNotification")
      .mockResolvedValue(success(undefined));
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("writes one row per recipient with the type, actor, resource and params", async () => {
    const otherId = await testApp.createTestUser({});

    const result = await dispatch.dispatch({
      type: "experiment_join_request_received",
      recipientIds: [recipientId, otherId],
      actorId,
      resource: experiment,
      // An absent optional must not reach the column, which holds strings only.
      params: { experimentName: "Photosynthesis", message: undefined },
    });

    assertSuccess(result);
    expect(result.value.created).toBe(2);

    const [row] = await rowsFor(recipientId);
    expect(row).toMatchObject({
      type: "experiment_join_request_received",
      actorId,
      resourceType: "experiment",
      resourceId: experiment.id,
      readAt: null,
    });
    expect(row.params).toEqual({ experimentName: "Photosynthesis" });
    expect(await rowsFor(otherId)).toHaveLength(1);
  });

  it("drops the actor and duplicate recipient ids", async () => {
    const result = await dispatch.dispatch({
      type: "experiment_join_request_approved",
      recipientIds: [recipientId, recipientId, actorId],
      actorId,
      resource: experiment,
      params: { experimentName: "Photosynthesis" },
    });

    assertSuccess(result);
    expect(result.value.created).toBe(1);
    expect(await rowsFor(recipientId)).toHaveLength(1);
    expect(await rowsFor(actorId)).toHaveLength(0);
  });

  it("writes nothing when the actor is the only recipient", async () => {
    const result = await dispatch.dispatch({
      type: "experiment_join_request_received",
      recipientIds: [actorId],
      actorId,
      resource: experiment,
      params: { experimentName: "Photosynthesis" },
    });

    assertSuccess(result);
    expect(result.value).toEqual({ created: 0, queued: 0 });
    expect(await rowsFor(actorId)).toHaveLength(0);
    expect(await deliveriesFor(actorId)).toHaveLength(0);
  });

  it("keeps the rows and queues nothing when the preferences cannot be read", async () => {
    vi.spyOn(
      testApp.module.get(NotificationPreferencesService),
      "emailEnabledFor",
    ).mockResolvedValue(failure(AppError.internal("Database unavailable")));

    const result = await dispatch.dispatch({
      type: "experiment_join_request_received",
      recipientIds: [recipientId],
      actorId,
      resource: experiment,
      params: { experimentName: "Photosynthesis" },
    });

    assertSuccess(result);
    expect(result.value).toEqual({ created: 1, queued: 0 });
    expect(await rowsFor(recipientId)).toHaveLength(1);
    expect(await deliveriesFor(recipientId)).toHaveLength(0);
  });

  it("refuses params that fail the type's schema and writes nothing", async () => {
    const result = await dispatch.dispatch({
      type: "experiment_join_request_approved",
      recipientIds: [recipientId],
      actorId,
      resource: experiment,
      // A producer passing the wrong shape is a programming error, caught at runtime
      // for the case the compiler cannot see.
      params: {} as NotificationParams<"experiment_join_request_approved">,
    });

    assertFailure(result);
    expect(await rowsFor(recipientId)).toHaveLength(0);
    expect(await deliveriesFor(recipientId)).toHaveLength(0);
  });

  it("queues one email per recipient with an address and none for one without", async () => {
    const deactivatedId = await testApp.createTestUser({ activated: false });

    const result = await dispatch.dispatch({
      type: "experiment_join_request_received",
      recipientIds: [recipientId, deactivatedId],
      actorId,
      resource: experiment,
      params: { experimentName: "Photosynthesis", message: "Please let me in" },
    });

    assertSuccess(result);
    expect(result.value).toEqual({ created: 2, queued: 1 });

    const [notification] = await rowsFor(recipientId);
    expect(await deliveriesFor(recipientId)).toEqual([
      {
        notificationId: notification.id,
        type: "experiment_join_request_received",
        channel: "email",
        status: "pending",
      },
    ]);
    // The row is stored either way; only the email is withheld.
    expect(await rowsFor(deactivatedId)).toHaveLength(1);
    expect(await deliveriesFor(deactivatedId)).toHaveLength(0);
  });

  it("hands the sending to the worker rather than the mail server", async () => {
    const result = await dispatch.dispatch({
      type: "experiment_join_request_received",
      recipientIds: [recipientId],
      actorId,
      resource: experiment,
      params: { experimentName: "Photosynthesis" },
    });

    assertSuccess(result);
    expect(result.value.queued).toBe(1);
    expect(sendSubmitted).not.toHaveBeenCalled();
    expect(sendAccessGranted).not.toHaveBeenCalled();
    expect(sendRejected).not.toHaveBeenCalled();
  });

  it("nudges the outbox once something is queued, and not when nothing is", async () => {
    const nudge = vi.spyOn(testApp.module.get(NotificationOutboxWorker), "nudge");

    const queued = await dispatch.dispatch({
      type: "experiment_join_request_received",
      recipientIds: [recipientId],
      actorId,
      resource: experiment,
      params: { experimentName: "Photosynthesis" },
    });

    assertSuccess(queued);
    expect(queued.value.queued).toBe(1);
    expect(nudge).toHaveBeenCalledTimes(1);

    nudge.mockClear();
    assertSuccess(
      await repository.upsertPreference(recipientId, "requests_and_invitations", "email", false),
    );

    // The rows are still written; there is just nothing for the worker to come for.
    const nothingQueued = await dispatch.dispatch({
      type: "experiment_join_request_received",
      recipientIds: [recipientId],
      actorId,
      resource: experiment,
      params: { experimentName: "Photosynthesis" },
    });

    assertSuccess(nothingQueued);
    expect(nothingQueued.value).toEqual({ created: 1, queued: 0 });
    expect(nudge).not.toHaveBeenCalled();
  });

  it("stores the row and queues nothing when the stored address is not an email address", async () => {
    // An ORCID sign-in that shares no address stores the ORCID id in `users.email`.
    const orcidId = await testApp.createTestUser({ email: "0000-0002-1825-0097" });

    const result = await dispatch.dispatch({
      type: "experiment_join_request_received",
      recipientIds: [orcidId],
      actorId,
      resource: experiment,
      params: { experimentName: "Photosynthesis" },
    });

    assertSuccess(result);
    expect(result.value).toEqual({ created: 1, queued: 0 });
    expect(await rowsFor(orcidId)).toHaveLength(1);
    expect(await deliveriesFor(orcidId)).toHaveLength(0);
  });

  it("stores the row and queues nothing when the type never emails", async () => {
    // No type is both `never` and equipped with an email, so pretend this one is
    // equipped: the channel policy is then the only thing that can hold the email back.
    vi.spyOn(notificationEmail, "hasEmail").mockReturnValue(true);

    const result = await dispatch.dispatch({
      type: "experiment_joined_with_code",
      recipientIds: [recipientId],
      actorId,
      resource: experiment,
      params: { experimentName: "Photosynthesis" },
    });

    assertSuccess(result);
    expect(result.value).toEqual({ created: 1, queued: 0 });
    expect(await deliveriesFor(recipientId)).toHaveLength(0);
  });

  it("stores the row and queues nothing for someone who switched the category's email off", async () => {
    const saved = await repository.upsertPreference(
      recipientId,
      "requests_and_invitations",
      "email",
      false,
    );
    assertSuccess(saved);

    const result = await dispatch.dispatch({
      type: "experiment_join_request_received",
      recipientIds: [recipientId],
      actorId,
      resource: experiment,
      params: { experimentName: "Photosynthesis" },
    });

    assertSuccess(result);
    expect(result.value).toEqual({ created: 1, queued: 0 });
    expect(await deliveriesFor(recipientId)).toHaveLength(0);
  });

  it("applies the category default when nobody saved a choice", async () => {
    // Data jobs are off by default; pretend the type has an email so only the
    // default can hold it back, then a saved opt-in lets it through.
    vi.spyOn(notificationEmail, "hasEmail").mockReturnValue(true);

    const offByDefault = await dispatch.dispatch({
      type: "data_export_completed",
      recipientIds: [recipientId],
      resource: experiment,
      params: { experimentName: "Photosynthesis", format: "CSV" },
    });
    assertSuccess(offByDefault);
    expect(offByDefault.value.queued).toBe(0);
    expect(await deliveriesFor(recipientId)).toHaveLength(0);

    assertSuccess(await repository.upsertPreference(recipientId, "data_jobs", "email", true));

    const optedIn = await dispatch.dispatch({
      type: "data_export_completed",
      recipientIds: [recipientId],
      resource: experiment,
      params: { experimentName: "Photosynthesis", format: "CSV" },
      dedupeKey: "second-export",
    });
    assertSuccess(optedIn);
    expect(optedIn.value.queued).toBe(1);
    expect(await deliveriesFor(recipientId)).toHaveLength(1);
  });

  it("ignores a saved opt-out for a type that always emails", async () => {
    // The use case refuses this write; the repository does not, which is the point.
    assertSuccess(
      await repository.upsertPreference(recipientId, "account_security", "email", false),
    );

    const result = await dispatch.dispatch({
      type: "api_key_created",
      recipientIds: [recipientId],
      params: { keyName: "Field laptop" },
    });

    assertSuccess(result);
    expect(result.value.queued).toBe(1);
    expect(await deliveriesFor(recipientId)).toHaveLength(1);
  });

  it("stores the row and queues nothing when the caller suppresses the email", async () => {
    // What the sign-in catch-up needs: the type emails by preference and has an
    // entry, so only `suppressEmail` can hold the email back — Better Auth already
    // sent it when the invitation was created.
    const invite = (suppressEmail: boolean, dedupeKey: string) =>
      dispatch.dispatch({
        type: "organization_invitation_received",
        recipientIds: [recipientId],
        actorId,
        resource: { type: "organization", id: crypto.randomUUID() },
        params: { organizationName: "Photosynthesis Lab", role: "member" },
        dedupeKey,
        suppressEmail,
      });

    const suppressed = await invite(true, "suppressed");
    assertSuccess(suppressed);
    expect(suppressed.value).toEqual({ created: 1, queued: 0 });
    expect(await rowsFor(recipientId)).toHaveLength(1);
    expect(await deliveriesFor(recipientId)).toHaveLength(0);

    // The control: the same dispatch without the flag does queue, so the flag is
    // what held it back rather than anything else about this type.
    const plain = await invite(false, "not-suppressed");
    assertSuccess(plain);
    expect(plain.value).toEqual({ created: 1, queued: 1 });
    expect(await deliveriesFor(recipientId)).toHaveLength(1);
  });

  it("stores the row and queues nothing for a type with no email entry yet", async () => {
    // `data_export_completed` is on the `preference` policy, so only the missing
    // entry keeps its email from going out.
    const result = await dispatch.dispatch({
      type: "data_export_completed",
      recipientIds: [recipientId],
      resource: experiment,
      params: { experimentName: "Photosynthesis", format: "CSV" },
    });

    assertSuccess(result);
    expect(result.value).toEqual({ created: 1, queued: 0 });
    expect(await deliveriesFor(recipientId)).toHaveLength(0);
    expect(sendAccessGranted).not.toHaveBeenCalled();
    expect(sendSubmitted).not.toHaveBeenCalled();
  });

  it("writes no row at all when the deliveries cannot be stored", async () => {
    const otherId = await testApp.createTestUser({ email: "other@example.com" });
    vi.spyOn(deliveryRepository, "insertMany").mockResolvedValue(
      failure(AppError.internal("Database unavailable")),
    );

    const result = await dispatch.dispatch({
      type: "experiment_join_request_rejected",
      recipientIds: [recipientId, otherId],
      actorId,
      resource: experiment,
      params: { experimentName: "Photosynthesis" },
    });

    // The bell rows and the emails they owe are one write, so a half of it that
    // fails takes the other half with it rather than leaving a silent notification.
    assertFailure(result);
    expect(await rowsFor(recipientId)).toHaveLength(0);
    expect(await rowsFor(otherId)).toHaveLength(0);
    expect(await deliveriesFor(recipientId)).toHaveLength(0);
    expect(await deliveriesFor(otherId)).toHaveLength(0);
  });

  it("keeps the rows and queues nothing when the recipients cannot be looked up", async () => {
    vi.spyOn(repository, "findUsers").mockResolvedValue(
      failure(AppError.internal("Database unavailable")),
    );

    const result = await dispatch.dispatch({
      type: "experiment_join_request_rejected",
      recipientIds: [recipientId],
      actorId,
      resource: experiment,
      params: { experimentName: "Photosynthesis" },
    });

    assertSuccess(result);
    expect(result.value).toEqual({ created: 1, queued: 0 });
    expect(await rowsFor(recipientId)).toHaveLength(1);
    expect(await deliveriesFor(recipientId)).toHaveLength(0);
  });

  it("writes and queues once when the same dedupe key arrives twice", async () => {
    const dispatchTwice = () =>
      dispatch.dispatch({
        type: "experiment_join_request_rejected",
        recipientIds: [recipientId],
        actorId,
        resource: experiment,
        params: { experimentName: "Photosynthesis" },
        dedupeKey: `experiment_join_request_rejected:${experiment.id}`,
      });

    assertSuccess(await dispatchTwice());
    const second = await dispatchTwice();

    assertSuccess(second);
    expect(second.value).toEqual({ created: 0, queued: 0 });
    expect(await rowsFor(recipientId)).toHaveLength(1);
    expect(await deliveriesFor(recipientId)).toHaveLength(1);
  });

  describe("once until read", () => {
    const versionParams = {
      experimentName: "Photosynthesis",
      workbookName: "Leaf protocol",
      version: "2",
    };

    const seedRow = (
      userId: string,
      row: { type?: "experiment_join_request_approved"; resourceId?: string } = {},
    ) =>
      repository.insertMany([
        {
          recipientId: userId,
          type: row.type ?? "workbook_version_published",
          actorId,
          resourceType: "experiment",
          resourceId: row.resourceId ?? experiment.id,
          params: versionParams,
          dedupeKey: null,
        },
      ]);

    const rejection = (onceUntilRead?: boolean, experimentName = "Photosynthesis") =>
      dispatch.dispatch({
        type: "experiment_join_request_rejected",
        recipientIds: [recipientId],
        actorId,
        resource: experiment,
        params: { experimentName },
        onceUntilRead,
      });

    it("refreshes only an unread row of the same type about the same resource", async () => {
      const laterActorId = await testApp.createTestUser({ name: "Later Actor" });
      const readId = await testApp.createTestUser({});
      const otherTypeId = await testApp.createTestUser({});
      const otherResourceId = await testApp.createTestUser({});

      const unreadRow = await seedRow(recipientId);
      assertSuccess(unreadRow);
      const longAgo = new Date("2020-01-01T00:00:00.000Z");
      await testApp.database
        .update(notifications)
        .set({ createdAt: longAgo })
        .where(eq(notifications.id, unreadRow.value[0].id));
      const readRow = await seedRow(readId);
      assertSuccess(readRow);
      assertSuccess(await repository.markRead(readId, [readRow.value[0].id]));
      assertSuccess(await seedRow(otherTypeId, { type: "experiment_join_request_approved" }));
      assertSuccess(await seedRow(otherResourceId, { resourceId: crypto.randomUUID() }));

      const result = await dispatch.dispatch({
        type: "workbook_version_published",
        recipientIds: [recipientId, readId, otherTypeId, otherResourceId],
        actorId: laterActorId,
        resource: experiment,
        params: { ...versionParams, version: "3" },
        onceUntilRead: true,
      });

      assertSuccess(result);
      expect(result.value).toEqual({ created: 3, queued: 0 });
      const [refreshed, ...more] = await rowsFor(recipientId);
      expect(more).toEqual([]);
      expect(refreshed).toMatchObject({
        id: unreadRow.value[0].id,
        actorId: laterActorId,
        params: { ...versionParams, version: "3" },
        readAt: null,
      });
      expect(refreshed.createdAt.getTime()).toBeGreaterThan(longAgo.getTime());
      expect(await rowsFor(readId)).toHaveLength(2);
      expect(await rowsFor(otherTypeId)).toHaveLength(2);
      expect(await rowsFor(otherResourceId)).toHaveLength(2);
    });

    it("keeps one row with the latest params while it is unread, and writes again once it is read", async () => {
      const first = await rejection(true);
      assertSuccess(first);
      expect(first.value).toEqual({ created: 1, queued: 1 });

      const second = await rejection(true, "Photosynthesis II");
      assertSuccess(second);
      expect(second.value).toEqual({ created: 0, queued: 0 });
      const [row, ...more] = await rowsFor(recipientId);
      expect(more).toEqual([]);
      expect(row.params).toEqual({ experimentName: "Photosynthesis II" });
      expect(await deliveriesFor(recipientId)).toHaveLength(1);

      assertSuccess(await repository.markRead(recipientId, [row.id]));

      const third = await rejection(true);
      assertSuccess(third);
      expect(third.value).toEqual({ created: 1, queued: 1 });
      expect(await rowsFor(recipientId)).toHaveLength(2);
      expect(await deliveriesFor(recipientId)).toHaveLength(2);
    });

    it("writes every time when the caller does not ask for it", async () => {
      assertSuccess(await rejection());
      const second = await rejection();

      assertSuccess(second);
      expect(second.value).toEqual({ created: 1, queued: 1 });
      expect(await rowsFor(recipientId)).toHaveLength(2);
    });

    it("writes nothing and logs when the unread rows cannot be refreshed", async () => {
      assertSuccess(await rejection());
      vi.spyOn(repository, "refreshUnread").mockResolvedValue(
        failure(AppError.internal("Database unavailable")),
      );
      const error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);

      const result = await rejection(true, "Photosynthesis II");

      assertFailure(result);
      const [row, ...more] = await rowsFor(recipientId);
      expect(more).toEqual([]);
      expect(row.params).toEqual({ experimentName: "Photosynthesis" });
      expect(await deliveriesFor(recipientId)).toHaveLength(1);
      expect(error).toHaveBeenCalledWith(
        expect.objectContaining({
          msg: "Failed to store notifications, nothing was written",
          operation: "dispatch-notification",
          errorCode: ErrorCodes.INTERNAL_SERVER_ERROR,
        }),
      );
    });

    /**
     * Racing two dispatches directly proves nothing: the harness pools one connection, so
     * they would run one after the other. Each runs on its own connection instead, the
     * first held just before its insert, and the second must either wait on the first or
     * finish before the first is let go.
     */
    it("leaves one row when two dispatches about the same event arrive at once", async () => {
      const first = createSecondaryDatabase();
      const second = createSecondaryDatabase();
      try {
        const serviceOn = (
          database: DatabaseInstance,
          notificationRepository: NotificationRepository,
        ) =>
          new NotificationDispatchService(
            database,
            notificationRepository,
            deliveryRepository,
            notificationEmail,
            testApp.module.get(NotificationPreferencesService),
            testApp.module.get(NotificationOutboxWorker),
          );
        const firstRepository = new NotificationRepository(first.database);
        const secondRepository = new NotificationRepository(second.database);
        const send = (service: NotificationDispatchService, experimentName: string) =>
          service.dispatch({
            type: "experiment_join_request_rejected",
            recipientIds: [recipientId],
            actorId,
            resource: experiment,
            params: { experimentName },
            onceUntilRead: true,
          });

        let release!: () => void;
        let reachedInsert!: () => void;
        const released = new Promise<void>((resolve) => {
          release = resolve;
        });
        const atInsert = new Promise<void>((resolve) => {
          reachedInsert = resolve;
        });
        const writer = new NotificationRepository(first.database);
        vi.spyOn(firstRepository, "insertMany").mockImplementation(async (rows, handle) => {
          reachedInsert();
          await released;
          return writer.insertMany(rows, handle);
        });

        const holding = send(serviceOn(first.database, firstRepository), "First");
        await atInsert;

        const [{ pid }] = await second.database.execute<{ pid: number }>(
          sql`SELECT pg_backend_pid() AS pid`,
        );
        const racingState = { done: false };
        const racing = send(serviceOn(second.database, secondRepository), "Second").finally(() => {
          racingState.done = true;
        });
        // Without the lock the second dispatch finds nothing unread and writes its own
        // row; with it, the second waits for the first to commit.
        for (let attempt = 0; attempt < 60 && !racingState.done; attempt++) {
          const [{ waiting }] = await testApp.database.execute<{ waiting: number }>(
            sql`SELECT count(*)::int AS waiting FROM pg_stat_activity
                WHERE pid = ${Number(pid)} AND wait_event_type = 'Lock'`,
          );
          if (Number(waiting) > 0) break;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }

        release();
        const results = await Promise.all([holding, racing]);

        const created = results.map((result) => {
          assertSuccess(result);
          return result.value.created;
        });
        expect(created).toEqual([1, 0]);
        const [row, ...more] = await rowsFor(recipientId);
        expect(more).toEqual([]);
        expect(row.params).toEqual({ experimentName: "Second" });
        expect(await deliveriesFor(recipientId)).toHaveLength(1);
      } finally {
        await Promise.all([first.close(), second.close()]);
      }
    });
  });

  // The access email needs a resource it can build a page link for. The registry
  // allows an organization as a notification resource and the page-link map has no
  // entry for one, so the sender has to refuse rather than email a link that 404s.
  describe("the access-granted email entry", () => {
    const grantedContext = (resource: { type: "organization"; id: string } | null) => ({
      recipientEmail,
      actorName: "Ada Lovelace",
      resource,
      params: { resourceName: "Greenhouse Lab", role: "viewer" },
    });

    it("refuses an organization resource", async () => {
      const result = await notificationEmail.send(
        "resource_access_granted",
        grantedContext({ type: "organization", id: crypto.randomUUID() }),
      );

      assertFailure(result);
      expect(result.error.message).toContain("non-shareable resource");
      expect(sendAccessGranted).not.toHaveBeenCalled();
    });

    it("refuses a notification stored with no resource", async () => {
      const result = await notificationEmail.send("resource_access_granted", grantedContext(null));

      assertFailure(result);
      expect(result.error.message).toContain("no resource to email about");
      expect(sendAccessGranted).not.toHaveBeenCalled();
    });
  });

  describe("the deletion email entry", () => {
    const deletedContext = (
      resource: { type: "device_group" | "organization"; id: string } | null,
      actorName: string | null = "Ada Lovelace",
    ) => ({
      recipientEmail,
      actorName,
      resource,
      params: { resourceName: "Greenhouse sensors" },
    });

    let sendDeleted: MockInstance<EmailAdapter["sendResourceDeletedNotification"]>;

    beforeEach(() => {
      sendDeleted = vi
        .spyOn(testApp.module.get(EmailAdapter), "sendResourceDeletedNotification")
        .mockResolvedValue(success(undefined));
    });

    it("sends the resource's type, name and actor, with a fallback for a missing actor", async () => {
      const result = await notificationEmail.send(
        "resource_deleted",
        deletedContext({ type: "device_group", id: crypto.randomUUID() }, null),
      );

      assertSuccess(result);
      expect(sendDeleted).toHaveBeenCalledWith({
        resourceType: "device_group",
        resourceName: "Greenhouse sensors",
        actor: "Someone",
        email: recipientEmail,
      });
    });

    it.each([
      ["an organization resource", { type: "organization" as const, id: crypto.randomUUID() }],
      ["no resource", null],
    ])("refuses %s", async (_, resource) => {
      const result = await notificationEmail.send("resource_deleted", deletedContext(resource));

      assertFailure(result);
      expect(result.error.message).toContain("without a shareable resource");
      expect(sendDeleted).not.toHaveBeenCalled();
    });
  });

  describe("the organization membership email entries", () => {
    const organization = { type: "organization" as const, id: crypto.randomUUID() };

    let sendRoleChanged: MockInstance<EmailAdapter["sendOrganizationRoleChangedNotification"]>;
    let sendRemoved: MockInstance<EmailAdapter["sendOrganizationMembershipRemovedNotification"]>;

    beforeEach(() => {
      const emailAdapter = testApp.module.get(EmailAdapter);
      sendRoleChanged = vi
        .spyOn(emailAdapter, "sendOrganizationRoleChangedNotification")
        .mockResolvedValue(success(undefined));
      sendRemoved = vi
        .spyOn(emailAdapter, "sendOrganizationMembershipRemovedNotification")
        .mockResolvedValue(success(undefined));
    });

    it.each([
      ["admin", "an admin of"],
      ["owner", "an owner of"],
      ["member", "a member of"],
      ["member,admin", "an admin of"],
    ])("words the stored role %s as %s, linking to the organization", async (role, wording) => {
      const result = await notificationEmail.send("organization_role_changed", {
        recipientEmail,
        actorName: "Ada Lovelace",
        resource: organization,
        params: { organizationName: "Greenhouse Lab", role },
      });

      assertSuccess(result);
      expect(sendRoleChanged).toHaveBeenCalledExactlyOnceWith({
        organizationId: organization.id,
        organizationName: "Greenhouse Lab",
        actor: "Ada Lovelace",
        role: wording,
        email: recipientEmail,
      });
    });

    it("refuses a role change stored with no resource", async () => {
      const result = await notificationEmail.send("organization_role_changed", {
        recipientEmail,
        actorName: "Ada Lovelace",
        resource: null,
        params: { organizationName: "Greenhouse Lab", role: "admin" },
      });

      assertFailure(result);
      expect(result.error.message).toContain("no resource to email about");
      expect(sendRoleChanged).not.toHaveBeenCalled();
    });

    it("sends a removal with no resource, falling back for a missing actor", async () => {
      const result = await notificationEmail.send("organization_membership_removed", {
        recipientEmail,
        actorName: null,
        resource: null,
        params: { organizationName: "Greenhouse Lab" },
      });

      assertSuccess(result);
      expect(sendRemoved).toHaveBeenCalledExactlyOnceWith({
        organizationName: "Greenhouse Lab",
        actor: "Someone",
        email: recipientEmail,
      });
    });
  });

  describe("the made-public email entry", () => {
    const madePublicContext = (resource: { type: "experiment"; id: string } | null) => ({
      recipientEmail,
      actorName: null,
      resource,
      params: { experimentName: "Leaf Area Index" },
    });

    let sendMadePublic: MockInstance<EmailAdapter["sendExperimentMadePublicNotification"]>;

    beforeEach(() => {
      sendMadePublic = vi
        .spyOn(testApp.module.get(EmailAdapter), "sendExperimentMadePublicNotification")
        .mockResolvedValue(success(undefined));
    });

    it("sends the experiment's id and name to the address", async () => {
      const result = await notificationEmail.send(
        "experiment_made_public",
        madePublicContext(experiment),
      );

      assertSuccess(result);
      expect(sendMadePublic).toHaveBeenCalledExactlyOnceWith(
        experiment.id,
        "Leaf Area Index",
        recipientEmail,
      );
    });

    it("refuses a notification stored with no resource", async () => {
      const result = await notificationEmail.send(
        "experiment_made_public",
        madePublicContext(null),
      );

      assertFailure(result);
      expect(result.error.message).toContain("no resource to email about");
      expect(sendMadePublic).not.toHaveBeenCalled();
    });
  });

  describe("the account security email entries", () => {
    const accountContext = <T>(params: T) => ({
      recipientEmail,
      actorName: null,
      resource: null,
      params,
    });

    let sendApiKeyCreated: MockInstance<EmailAdapter["sendApiKeyCreatedNotification"]>;
    let sendPasskeyAdded: MockInstance<EmailAdapter["sendPasskeyAddedNotification"]>;

    beforeEach(() => {
      const emailAdapter = testApp.module.get(EmailAdapter);
      sendApiKeyCreated = vi
        .spyOn(emailAdapter, "sendApiKeyCreatedNotification")
        .mockResolvedValue(success(undefined));
      sendPasskeyAdded = vi
        .spyOn(emailAdapter, "sendPasskeyAddedNotification")
        .mockResolvedValue(success(undefined));
    });

    it("sends the key's name with no resource", async () => {
      const result = await notificationEmail.send(
        "api_key_created",
        accountContext({ keyName: "Field laptop" }),
      );

      assertSuccess(result);
      expect(sendApiKeyCreated).toHaveBeenCalledExactlyOnceWith({
        keyName: "Field laptop",
        email: recipientEmail,
      });
    });

    it.each([["Google Password Manager"], [undefined]])(
      "passes the passkey's name through as stored: %s",
      async (passkeyName) => {
        const result = await notificationEmail.send(
          "passkey_added",
          accountContext({ passkeyName }),
        );

        assertSuccess(result);
        expect(sendPasskeyAdded).toHaveBeenCalledExactlyOnceWith({
          passkeyName,
          email: recipientEmail,
        });
      },
    );
  });

  it("writes both rows on a replay after a first attempt rolled back", async () => {
    const send = {
      type: "experiment_join_request_received" as const,
      recipientIds: [recipientId],
      actorId,
      resource: experiment,
      params: { experimentName: "Photosynthesis" },
      dedupeKey: "one-event",
    };
    const deliveryInsert = vi.spyOn(deliveryRepository, "insertMany");

    deliveryInsert.mockResolvedValueOnce(failure(AppError.internal("Database unavailable")));
    assertFailure(await dispatch.dispatch(send));
    // Nothing survived the first attempt, dedupe key included.
    expect(await rowsFor(recipientId)).toHaveLength(0);

    const replay = await dispatch.dispatch(send);

    // So the replay is not deduped against a row that was rolled back.
    assertSuccess(replay);
    expect(replay.value).toEqual({ created: 1, queued: 1 });
    expect(await rowsFor(recipientId)).toHaveLength(1);
    expect(await deliveriesFor(recipientId)).toHaveLength(1);
  });

  it("fails and queues nothing when the rows cannot be stored", async () => {
    vi.spyOn(repository, "insertMany").mockResolvedValue(
      failure(AppError.internal("Database unavailable")),
    );

    const result = await dispatch.dispatch({
      type: "experiment_join_request_rejected",
      recipientIds: [recipientId],
      actorId,
      resource: experiment,
      params: { experimentName: "Photosynthesis" },
    });

    assertFailure(result);
    expect(await deliveriesFor(recipientId)).toHaveLength(0);
  });
});
