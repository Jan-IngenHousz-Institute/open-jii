import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import type {
  NotificationList,
  NotificationPreferences,
} from "@repo/api/domains/notification/notification.schema";
import { eq, notifications } from "@repo/database";

import { failure, AppError } from "../../common/utils/fp-utils";
import type { SuperTestResponse } from "../../test/test-harness";
import { TestHarness } from "../../test/test-harness";
import { ListNotificationsUseCase } from "../application/use-cases/list-notifications/list-notifications";

describe("NotificationController", () => {
  const testApp = TestHarness.App;
  let recipientId: string;
  let otherUserId: string;
  let actorId: string;

  const insertNotification = (
    values: Partial<typeof notifications.$inferInsert> & { recipientId: string },
  ) =>
    testApp.database
      .insert(notifications)
      .values({ type: "experiment_join_request_received", ...values })
      .returning({ id: notifications.id })
      .then(([row]) => row.id);

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    recipientId = await testApp.createTestUser({});
    otherUserId = await testApp.createTestUser({});
    actorId = await testApp.createTestUser({});
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("listNotifications", () => {
    it("returns only the caller's notifications, newest first, with the actor's name", async () => {
      await insertNotification({
        recipientId,
        actorId,
        params: { experimentName: "Older" },
        createdAt: new Date("2026-01-01T10:00:00.000Z"),
      });
      await insertNotification({
        recipientId,
        type: "data_export_completed",
        params: { experimentName: "Newer", format: "CSV" },
        createdAt: new Date("2026-01-02T10:00:00.000Z"),
      });
      await insertNotification({ recipientId: otherUserId, params: { experimentName: "Theirs" } });

      const response: SuperTestResponse<NotificationList> = await testApp
        .get(testApp.resolveOrpcPath(contract.notifications.listNotifications))
        .withAuth(recipientId)
        .expect(StatusCodes.OK);

      expect(response.body.totalCount).toBe(2);
      expect(response.body.items.map((item) => item.params.experimentName)).toEqual([
        "Newer",
        "Older",
      ]);
      expect(response.body.items[0]).toMatchObject({
        type: "data_export_completed",
        category: "data_jobs",
        actor: null,
        readAt: null,
      });
      expect(response.body.items[1].actor).toMatchObject({ id: actorId });
    });

    it("filters to unread notifications and to one category", async () => {
      await insertNotification({ recipientId, readAt: new Date() });
      await insertNotification({ recipientId, params: { experimentName: "Unread request" } });
      await insertNotification({ recipientId, type: "data_export_failed" });

      const unread: SuperTestResponse<NotificationList> = await testApp
        .get(testApp.resolveOrpcPath(contract.notifications.listNotifications))
        .withAuth(recipientId)
        .query({ readState: "unread", category: "requests_and_invitations" })
        .expect(StatusCodes.OK);

      expect(unread.body.items).toHaveLength(1);
      expect(unread.body.items[0].params.experimentName).toBe("Unread request");
    });

    it("pages with the shared list envelope", async () => {
      for (let index = 0; index < 3; index++) {
        await insertNotification({ recipientId });
      }

      const response: SuperTestResponse<NotificationList> = await testApp
        .get(testApp.resolveOrpcPath(contract.notifications.listNotifications))
        .withAuth(recipientId)
        .query({ page: 2, pageSize: 2 })
        .expect(StatusCodes.OK);

      expect(response.body).toMatchObject({ page: 2, pageSize: 2, totalPages: 2, totalCount: 3 });
      expect(response.body.items).toHaveLength(1);
    });

    it("returns 401 if not authenticated", async () => {
      await testApp
        .get(testApp.resolveOrpcPath(contract.notifications.listNotifications))
        .withoutAuth()
        .expect(StatusCodes.UNAUTHORIZED);
    });

    it("returns 500 when the use case fails", async () => {
      vi.spyOn(testApp.module.get(ListNotificationsUseCase), "execute").mockResolvedValue(
        failure(AppError.internal("Database error")),
      );

      await testApp
        .get(testApp.resolveOrpcPath(contract.notifications.listNotifications))
        .withAuth(recipientId)
        .expect(StatusCodes.INTERNAL_SERVER_ERROR);
    });
  });

  describe("getUnreadNotificationCount", () => {
    it("counts only the caller's unread notifications", async () => {
      await insertNotification({ recipientId });
      await insertNotification({ recipientId });
      await insertNotification({ recipientId, readAt: new Date() });
      await insertNotification({ recipientId: otherUserId });

      const response = await testApp
        .get(testApp.resolveOrpcPath(contract.notifications.getUnreadNotificationCount))
        .withAuth(recipientId)
        .expect(StatusCodes.OK);

      expect(response.body).toEqual({ count: 2 });
    });
  });

  describe("markNotificationsRead", () => {
    it("marks the caller's notifications and ignores someone else's", async () => {
      const mine = await insertNotification({ recipientId });
      const theirs = await insertNotification({ recipientId: otherUserId });

      const response = await testApp
        .post(testApp.resolveOrpcPath(contract.notifications.markNotificationsRead))
        .withAuth(recipientId)
        .send({ ids: [mine, theirs] })
        .expect(StatusCodes.OK);

      expect(response.body).toEqual({ updated: 1 });
      const [theirRow] = await testApp.database
        .select({ readAt: notifications.readAt })
        .from(notifications)
        .where(eq(notifications.id, theirs));
      expect(theirRow.readAt).toBeNull();
    });

    it("rejects an empty list of ids", async () => {
      await testApp
        .post(testApp.resolveOrpcPath(contract.notifications.markNotificationsRead))
        .withAuth(recipientId)
        .send({ ids: [] })
        .expect(StatusCodes.BAD_REQUEST);
    });
  });

  describe("markAllNotificationsRead", () => {
    it("clears the caller's unread count and leaves other people's alone", async () => {
      await insertNotification({ recipientId });
      await insertNotification({ recipientId });
      await insertNotification({ recipientId: otherUserId });

      const response = await testApp
        .post(testApp.resolveOrpcPath(contract.notifications.markAllNotificationsRead))
        .withAuth(recipientId)
        .expect(StatusCodes.OK);

      expect(response.body).toEqual({ updated: 2 });
      const others = await testApp
        .get(testApp.resolveOrpcPath(contract.notifications.getUnreadNotificationCount))
        .withAuth(otherUserId)
        .expect(StatusCodes.OK);
      expect(others.body).toEqual({ count: 1 });
    });
  });

  describe("notification preferences", () => {
    it("returns every category's email default when nothing is saved", async () => {
      const response: SuperTestResponse<NotificationPreferences> = await testApp
        .get(testApp.resolveOrpcPath(contract.notifications.getNotificationPreferences))
        .withAuth(recipientId)
        .expect(StatusCodes.OK);

      expect(response.body.preferences).toHaveLength(7);
      expect(response.body.preferences).toContainEqual({
        category: "requests_and_invitations",
        channel: "email",
        enabled: true,
        locked: false,
      });
      expect(response.body.preferences).toContainEqual({
        category: "data_jobs",
        channel: "email",
        enabled: false,
        locked: false,
      });
      expect(response.body.preferences).toContainEqual({
        category: "account_security",
        channel: "email",
        enabled: true,
        locked: true,
      });
    });

    it("saves one category without touching the others or other people", async () => {
      const response: SuperTestResponse<NotificationPreferences> = await testApp
        .put(testApp.resolveOrpcPath(contract.notifications.updateNotificationPreference))
        .withAuth(recipientId)
        .send({ category: "membership_and_access", channel: "email", enabled: false })
        .expect(StatusCodes.OK);

      expect(response.body.preferences).toContainEqual(
        expect.objectContaining({ category: "membership_and_access", enabled: false }),
      );
      expect(response.body.preferences).toContainEqual(
        expect.objectContaining({ category: "requests_and_invitations", enabled: true }),
      );

      const others: SuperTestResponse<NotificationPreferences> = await testApp
        .get(testApp.resolveOrpcPath(contract.notifications.getNotificationPreferences))
        .withAuth(otherUserId)
        .expect(StatusCodes.OK);
      expect(others.body.preferences).toContainEqual(
        expect.objectContaining({ category: "membership_and_access", enabled: true }),
      );
    });

    it("refuses to mute account security emails", async () => {
      await testApp
        .put(testApp.resolveOrpcPath(contract.notifications.updateNotificationPreference))
        .withAuth(recipientId)
        .send({ category: "account_security", channel: "email", enabled: false })
        .expect(StatusCodes.BAD_REQUEST);
    });
  });

  describe("unknown types", () => {
    it("skips a row whose type this build does not know", async () => {
      await insertNotification({ recipientId, type: "a_type_from_a_newer_deploy" });
      await insertNotification({ recipientId, params: { experimentName: "Known" } });

      const response: SuperTestResponse<NotificationList> = await testApp
        .get(testApp.resolveOrpcPath(contract.notifications.listNotifications))
        .withAuth(recipientId)
        .expect(StatusCodes.OK);

      expect(response.body.items.map((item) => item.params.experimentName)).toEqual(["Known"]);
    });
  });
});
