/* eslint-disable @typescript-eslint/unbound-method */
import { faker } from "@faker-js/faker";

import { eq, notifications } from "@repo/database";

import { EmailAdapter } from "../../../../common/modules/email/services/email.adapter";
import { assertSuccess, failure, success, AppError } from "../../../../common/utils/fp-utils";
import { NotificationDispatchService } from "../../../../notifications/application/services/notification-dispatch.service";
import { TestHarness } from "../../../../test/test-harness";
import { ExperimentJoinRequestRepository } from "../../../core/repositories/experiment-join-request.repository";
import { RequestJoinExperimentUseCase } from "./request-join-experiment";

describe("RequestJoinExperimentUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: RequestJoinExperimentUseCase;
  let emailAdapter: EmailAdapter;
  let ownerUserId: string;
  let secondAdminUserId: string;
  let requesterUserId: string;

  const notificationsFor = (userId: string) =>
    testApp.database.select().from(notifications).where(eq(notifications.recipientId, userId));

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    ownerUserId = await testApp.createTestUser({ email: "owner@example.com", name: "Olga Owner" });
    secondAdminUserId = await testApp.createTestUser({
      email: "second-admin@example.com",
      name: "Adam Admin",
    });
    requesterUserId = await testApp.createTestUser({
      email: "requester@example.com",
      name: "Joe Requester",
    });
    useCase = testApp.module.get(RequestJoinExperimentUseCase);
    emailAdapter = testApp.module.get(EmailAdapter);
    vi.spyOn(emailAdapter, "sendJoinRequestSubmittedNotification").mockResolvedValue(
      success(undefined),
    );
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  // A public experiment owned by `ownerUserId`, with a second admin holding a grant.
  async function seedExperiment() {
    const { experiment } = await testApp.createExperiment({
      name: `Request ${faker.string.uuid()}`,
      userId: ownerUserId,
      visibility: "public",
    });
    await testApp.addExperimentAdmin(experiment.id, secondAdminUserId);
    return experiment;
  }

  it("notifies every admin and the owning org's owner, and mails each once", async () => {
    const experiment = await seedExperiment();

    const result = await useCase.execute(experiment.id, requesterUserId, "let me in");

    assertSuccess(result);
    expect(result.value.created).toBe(true);

    for (const adminId of [ownerUserId, secondAdminUserId]) {
      const [row] = await notificationsFor(adminId);
      expect(row).toMatchObject({
        type: "experiment_join_request_received",
        actorId: requesterUserId,
        resourceType: "experiment",
        resourceId: experiment.id,
        // The requester's message rides along for the email; the bell does not show it.
        params: { experimentName: experiment.name, message: "let me in" },
      });
    }

    // The requester hears nothing about their own request.
    expect(await notificationsFor(requesterUserId)).toHaveLength(0);

    expect(emailAdapter.sendJoinRequestSubmittedNotification).toHaveBeenCalledTimes(2);
    expect(emailAdapter.sendJoinRequestSubmittedNotification).toHaveBeenCalledWith(
      experiment.id,
      experiment.name,
      "Joe Requester",
      "owner@example.com",
      "let me in",
    );
    expect(emailAdapter.sendJoinRequestSubmittedNotification).toHaveBeenCalledWith(
      experiment.id,
      experiment.name,
      "Joe Requester",
      "second-admin@example.com",
      "let me in",
    );
  });

  it("leaves the message out of the params when the requester sent none", async () => {
    const experiment = await seedExperiment();

    const result = await useCase.execute(experiment.id, requesterUserId, undefined);

    assertSuccess(result);
    const [row] = await notificationsFor(ownerUserId);
    // The column holds strings only, so an absent message must not reach it.
    expect(row.params).toEqual({ experimentName: experiment.name });
  });

  it("notifies nobody when a pending request already exists", async () => {
    const experiment = await seedExperiment();
    assertSuccess(await useCase.execute(experiment.id, requesterUserId, "let me in"));

    const second = await useCase.execute(experiment.id, requesterUserId, "let me in again");

    assertSuccess(second);
    expect(second.value.created).toBe(false);
    expect(await notificationsFor(ownerUserId)).toHaveLength(1);
  });

  it("still creates the request when the notification cannot be dispatched", async () => {
    const experiment = await seedExperiment();
    vi.spyOn(testApp.module.get(NotificationDispatchService), "dispatch").mockResolvedValue(
      failure(AppError.internal("notifications unavailable")),
    );

    const result = await useCase.execute(experiment.id, requesterUserId, "let me in");

    assertSuccess(result);
    expect(result.value.created).toBe(true);
  });

  it("still creates the request when the admins cannot be looked up", async () => {
    const experiment = await seedExperiment();
    const dispatch = vi.spyOn(testApp.module.get(NotificationDispatchService), "dispatch");
    vi.spyOn(testApp.module.get(ExperimentJoinRequestRepository), "listAdminIds").mockResolvedValue(
      failure(AppError.internal("Database unavailable")),
    );

    const result = await useCase.execute(experiment.id, requesterUserId, "let me in");

    assertSuccess(result);
    expect(result.value.created).toBe(true);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
