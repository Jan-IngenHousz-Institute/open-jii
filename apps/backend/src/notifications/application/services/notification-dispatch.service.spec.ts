import type { MockInstance } from "vitest";

import type { NotificationParams } from "@repo/api/domains/notification/notification.schema";
import { eq, notifications } from "@repo/database";

import { EmailAdapter } from "../../../common/modules/email/services/email.adapter";
import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { NotificationRepository } from "../../core/repositories/notification.repository";
import { NotificationDispatchService } from "./notification-dispatch.service";
import { NotificationEmailService } from "./notification-email.service";

describe("NotificationDispatchService", () => {
  const testApp = TestHarness.App;
  let dispatch: NotificationDispatchService;
  let repository: NotificationRepository;
  let notificationEmail: NotificationEmailService;
  let sendSubmitted: MockInstance<EmailAdapter["sendJoinRequestSubmittedNotification"]>;
  let sendAdded: MockInstance<EmailAdapter["sendAddedUserNotification"]>;
  let sendRejected: MockInstance<EmailAdapter["sendJoinRequestRejectedNotification"]>;
  let actorId: string;
  let recipientId: string;
  let recipientEmail: string;
  const experiment = { type: "experiment" as const, id: crypto.randomUUID() };

  const rowsFor = (userId: string) =>
    testApp.database.select().from(notifications).where(eq(notifications.recipientId, userId));

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
    notificationEmail = testApp.module.get(NotificationEmailService);

    const emailAdapter = testApp.module.get(EmailAdapter);
    sendSubmitted = vi
      .spyOn(emailAdapter, "sendJoinRequestSubmittedNotification")
      .mockResolvedValue(success(undefined));
    sendAdded = vi
      .spyOn(emailAdapter, "sendAddedUserNotification")
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
    expect(sendAdded).not.toHaveBeenCalled();
  });

  it("emails every recipient with an address and skips one without", async () => {
    const deactivatedId = await testApp.createTestUser({ activated: false });

    const result = await dispatch.dispatch({
      type: "experiment_join_request_received",
      recipientIds: [recipientId, deactivatedId],
      actorId,
      resource: experiment,
      params: { experimentName: "Photosynthesis", message: "Please let me in" },
    });

    assertSuccess(result);
    expect(result.value).toEqual({ created: 2, emailed: 1 });
    expect(sendSubmitted).toHaveBeenCalledExactlyOnceWith(
      experiment.id,
      "Photosynthesis",
      "Ada Lovelace",
      recipientEmail,
      "Please let me in",
    );
    // The row is stored either way; only the email is withheld.
    expect(await rowsFor(deactivatedId)).toHaveLength(1);
  });

  it("stores the row and sends nothing when the type never emails", async () => {
    // No type is both `never` and equipped with an email, so pretend this one is
    // equipped: the channel policy is then the only thing that can hold the email back.
    vi.spyOn(notificationEmail, "hasEmail").mockReturnValue(true);
    const send = vi.spyOn(notificationEmail, "send");

    const result = await dispatch.dispatch({
      type: "experiment_joined_with_code",
      recipientIds: [recipientId],
      actorId,
      resource: experiment,
      params: { experimentName: "Photosynthesis" },
    });

    assertSuccess(result);
    expect(result.value).toEqual({ created: 1, emailed: 0 });
    expect(send).not.toHaveBeenCalled();
  });

  it("stores the row and sends nothing for a type with no email entry yet", async () => {
    // `data_export_completed` is on the `preference` policy, so only the missing
    // entry keeps its email from going out.
    const result = await dispatch.dispatch({
      type: "data_export_completed",
      recipientIds: [recipientId],
      resource: experiment,
      params: { experimentName: "Photosynthesis", format: "CSV" },
    });

    assertSuccess(result);
    expect(result.value).toEqual({ created: 1, emailed: 0 });
    expect(sendAdded).not.toHaveBeenCalled();
    expect(sendSubmitted).not.toHaveBeenCalled();
  });

  it("keeps every row and sends the rest when one email fails", async () => {
    const otherId = await testApp.createTestUser({ email: "other@example.com" });
    sendRejected.mockResolvedValueOnce(failure(AppError.internal("Mail server refused")));

    const result = await dispatch.dispatch({
      type: "experiment_join_request_rejected",
      recipientIds: [recipientId, otherId],
      actorId,
      resource: experiment,
      params: { experimentName: "Photosynthesis" },
    });

    assertSuccess(result);
    expect(result.value).toEqual({ created: 2, emailed: 1 });
    expect(await rowsFor(recipientId)).toHaveLength(1);
    expect(await rowsFor(otherId)).toHaveLength(1);
  });

  it("keeps the rows and sends nothing when the recipients cannot be looked up", async () => {
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
    expect(result.value).toEqual({ created: 1, emailed: 0 });
    expect(await rowsFor(recipientId)).toHaveLength(1);
    expect(sendRejected).not.toHaveBeenCalled();
  });

  it("writes and emails once when the same dedupe key arrives twice", async () => {
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
    expect(second.value).toEqual({ created: 0, emailed: 0 });
    expect(await rowsFor(recipientId)).toHaveLength(1);
    expect(sendRejected).toHaveBeenCalledTimes(1);
  });

  it("fails and sends nothing when the rows cannot be stored", async () => {
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
    expect(sendRejected).not.toHaveBeenCalled();
  });
});
