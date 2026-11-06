import { StatusCodes } from "http-status-codes";

import { redactRequestUrl } from "@repo/analytics";
import { contract } from "@repo/api/contract";
import type {
  EmailPreferenceByTokenResponse,
  NotificationCategory,
} from "@repo/api/domains/notification/notification.schema";
import { and, eq, notificationPreferences, profiles, users } from "@repo/database";

import { ErrorCodes } from "../../common/utils/error-codes";
import { AppError, failure } from "../../common/utils/fp-utils";
import type { SuperTestResponse } from "../../test/test-harness";
import { TestHarness } from "../../test/test-harness";
import { NotificationUnsubscribeService } from "../application/services/notification-unsubscribe.service";
import { NotificationRepository } from "../core/repositories/notification.repository";

describe("NotificationUnsubscribeController", () => {
  const testApp = TestHarness.App;
  let unsubscribe: NotificationUnsubscribeService;
  let userId: string;
  let clientIp = 0;

  const unsubscribePath = (token: string) =>
    testApp.resolveOrpcPath(contract.notifications.unsubscribeEmailByToken, { token });
  const resubscribePath = (token: string) =>
    testApp.resolveOrpcPath(contract.notifications.resubscribeEmailByToken, { token });

  const nextClientIp = () => `203.0.113.${++clientIp}`;

  const emailRowsFor = (id: string, category: NotificationCategory) =>
    testApp.database
      .select({ enabled: notificationPreferences.enabled })
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.userId, id),
          eq(notificationPreferences.category, category),
          eq(notificationPreferences.channel, "email"),
        ),
      );

  const expectInvalidLink = (response: { body: unknown }) => {
    expect(response.body).toMatchObject({
      data: { code: ErrorCodes.NOTIFICATION_UNSUBSCRIBE_LINK_INVALID },
    });
  };

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    unsubscribe = testApp.module.get(NotificationUnsubscribeService);
    userId = await testApp.createTestUser({});
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("turns the category's email off without a session and answers the category", async () => {
    const token = unsubscribe.sign(userId, "requests_and_invitations");

    const response: SuperTestResponse<EmailPreferenceByTokenResponse> = await testApp
      .post(unsubscribePath(token))
      .withoutAuth()
      .set("X-Forwarded-For", nextClientIp())
      .expect(StatusCodes.OK);

    expect(response.body).toEqual({ category: "requests_and_invitations" });
    expect(await emailRowsFor(userId, "requests_and_invitations")).toEqual([{ enabled: false }]);
  });

  it("turns the category's email back on through the resubscribe route", async () => {
    const token = unsubscribe.sign(userId, "requests_and_invitations");
    await testApp
      .post(unsubscribePath(token))
      .withoutAuth()
      .set("X-Forwarded-For", nextClientIp())
      .expect(StatusCodes.OK);

    const response: SuperTestResponse<EmailPreferenceByTokenResponse> = await testApp
      .post(resubscribePath(token))
      .withoutAuth()
      .set("X-Forwarded-For", nextClientIp())
      .expect(StatusCodes.OK);

    expect(response.body).toEqual({ category: "requests_and_invitations" });
    expect(await emailRowsFor(userId, "requests_and_invitations")).toEqual([{ enabled: true }]);
  });

  it("accepts a mail client's one-click form body", async () => {
    const token = unsubscribe.sign(userId, "project_transfers");

    const response: SuperTestResponse<EmailPreferenceByTokenResponse> = await testApp
      .post(unsubscribePath(token))
      .withoutAuth()
      .set("X-Forwarded-For", nextClientIp())
      .type("form")
      .send("List-Unsubscribe=One-Click")
      .expect(StatusCodes.OK);

    expect(response.body).toEqual({ category: "project_transfers" });
    expect(await emailRowsFor(userId, "project_transfers")).toEqual([{ enabled: false }]);
  });

  it("refuses an altered token and writes nothing", async () => {
    const token = unsubscribe.sign(userId, "requests_and_invitations");
    const altered = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;

    const response = await testApp
      .post(unsubscribePath(altered))
      .withoutAuth()
      .set("X-Forwarded-For", nextClientIp())
      .expect(StatusCodes.BAD_REQUEST);

    expectInvalidLink(response);
    expect(await emailRowsFor(userId, "requests_and_invitations")).toEqual([]);
  });

  it("refuses an expired token", async () => {
    const token = unsubscribe.sign(
      userId,
      "requests_and_invitations",
      new Date(Date.now() - 60_000),
    );

    const response = await testApp
      .post(unsubscribePath(token))
      .withoutAuth()
      .set("X-Forwarded-For", nextClientIp())
      .expect(StatusCodes.BAD_REQUEST);

    expectInvalidLink(response);
    expect(await emailRowsFor(userId, "requests_and_invitations")).toEqual([]);
  });

  it("refuses a token for a locked category", async () => {
    const token = unsubscribe.sign(userId, "account_security");

    const response = await testApp
      .post(unsubscribePath(token))
      .withoutAuth()
      .set("X-Forwarded-For", nextClientIp())
      .expect(StatusCodes.BAD_REQUEST);

    expectInvalidLink(response);
    expect(await emailRowsFor(userId, "account_security")).toEqual([]);
  });

  it("refuses a token for a user deleted after it was signed", async () => {
    const token = unsubscribe.sign(userId, "requests_and_invitations");
    await testApp.database.delete(profiles).where(eq(profiles.userId, userId));
    await testApp.database.delete(users).where(eq(users.id, userId));

    const response = await testApp
      .post(unsubscribePath(token))
      .withoutAuth()
      .set("X-Forwarded-For", nextClientIp())
      .expect(StatusCodes.BAD_REQUEST);

    expectInvalidLink(response);
  });

  it("refuses an altered token on the resubscribe route", async () => {
    const token = unsubscribe.sign(userId, "requests_and_invitations");
    const altered = `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`;

    const response = await testApp
      .post(resubscribePath(altered))
      .withoutAuth()
      .set("X-Forwarded-For", nextClientIp())
      .expect(StatusCodes.BAD_REQUEST);

    expectInvalidLink(response);
    expect(await emailRowsFor(userId, "requests_and_invitations")).toEqual([]);
  });

  it("answers a server error when the database fails for a reason other than a deleted account", async () => {
    // Drizzle's message carries the failed query, whose "on conflict" a text match reads as a duplicate.
    const outage = new Error(
      'Failed query: insert into "notification_preferences" on conflict do update',
      { cause: new Error("Connection terminated unexpectedly") },
    );
    vi.spyOn(testApp.database, "insert").mockImplementationOnce(() => {
      throw outage;
    });

    const response = await testApp
      .post(unsubscribePath(unsubscribe.sign(userId, "requests_and_invitations")))
      .withoutAuth()
      .set("X-Forwarded-For", nextClientIp())
      .expect(StatusCodes.INTERNAL_SERVER_ERROR);

    // Details reach the body only outside production; they are what the error log carries.
    expect(response.body).toMatchObject({
      data: { details: "Connection terminated unexpectedly" },
    });
    expect(JSON.stringify(response.body)).not.toContain("Failed query");
  });

  it("answers a server error, not a refused link, when the preference cannot be saved", async () => {
    vi.spyOn(testApp.module.get(NotificationRepository), "upsertPreference").mockResolvedValueOnce(
      failure(AppError.internal("Database unavailable")),
    );

    const response = await testApp
      .post(unsubscribePath(unsubscribe.sign(userId, "requests_and_invitations")))
      .withoutAuth()
      .set("X-Forwarded-For", nextClientIp())
      .expect(StatusCodes.INTERNAL_SERVER_ERROR);

    expect(response.body).not.toMatchObject({
      data: { code: ErrorCodes.NOTIFICATION_UNSUBSCRIBE_LINK_INVALID },
    });
  });

  it.each([
    ["unsubscribe", contract.notifications.unsubscribeEmailByToken],
    ["resubscribe", contract.notifications.resubscribeEmailByToken],
  ])("keeps the token of the %s route out of the request log", (_, route) => {
    const token = unsubscribe.sign(userId, "requests_and_invitations");
    const logged = redactRequestUrl(testApp.resolveOrpcPath(route, { token }));

    expect(logged).not.toContain(token);
    expect(logged).toBe(testApp.resolveOrpcPath(route, { token: "[redacted]" }));
  });

  it("allows ten requests per client per minute, then answers 429", async () => {
    const token = unsubscribe.sign(userId, "requests_and_invitations");
    const ip = nextClientIp();

    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      const response = await testApp
        .post(unsubscribePath(token))
        .withoutAuth()
        .set("X-Forwarded-For", ip);
      statuses.push(response.status);
    }

    expect(statuses).toEqual([
      ...Array<number>(10).fill(StatusCodes.OK),
      StatusCodes.TOO_MANY_REQUESTS,
    ]);
  });
});
