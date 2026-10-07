/* eslint-disable @typescript-eslint/unbound-method */
import { eq, notifications } from "@repo/database";

import { DatabricksAdapter } from "../../../../../common/modules/databricks/databricks.adapter";
import { EmailAdapter } from "../../../../../common/modules/email/services/email.adapter";
import {
  assertFailure,
  assertSuccess,
  failure,
  success,
  AppError,
} from "../../../../../common/utils/fp-utils";
import { NotificationRepository } from "../../../../../notifications/core/repositories/notification.repository";
import { TestHarness } from "../../../../../test/test-harness";
import { CreateTransferRequestUseCase } from "./create-transfer-request";

describe("CreateTransferRequest", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let testUserEmail: string;
  let useCase: CreateTransferRequestUseCase;
  let databricksAdapter: DatabricksAdapter;
  let emailAdapter: EmailAdapter;

  const input = {
    projectIdOld: "12345",
    projectUrlOld: "https://photosynq.org/projects/12345",
  };

  const notificationsFor = (userId: string) =>
    testApp.database.select().from(notifications).where(eq(notifications.recipientId, userId));

  // findExistingRequest finds nothing, then createTransferRequest inserts a row.
  const mockCreatePath = () =>
    vi
      .spyOn(databricksAdapter, "executeSqlQuery")
      .mockResolvedValueOnce(success({ columns: [], rows: [], totalRows: 0, truncated: false }))
      .mockResolvedValueOnce(success({ columns: [], rows: [], totalRows: 1, truncated: false }));

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserEmail = "test@example.com";
    testUserId = await testApp.createTestUser({ email: testUserEmail });

    useCase = testApp.module.get(CreateTransferRequestUseCase);
    databricksAdapter = testApp.module.get(DatabricksAdapter);
    emailAdapter = testApp.module.get(EmailAdapter);
    vi.spyOn(emailAdapter, "sendTransferRequestConfirmation").mockResolvedValue(success(undefined));
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should create a transfer request and notify the requester", async () => {
    mockCreatePath();

    // Act
    const result = await useCase.execute(testUserId, testUserEmail, input);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toMatchObject({
      userId: testUserId,
      userEmail: testUserEmail,
      sourcePlatform: "photosynq",
      projectIdOld: input.projectIdOld,
      projectUrlOld: input.projectUrlOld,
      status: "pending",
    });
    expect(result.value.requestId).toBeDefined();
    expect(result.value.requestedAt).toBeInstanceOf(Date);

    const rows = await notificationsFor(testUserId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "project_transfer_requested",
      actorId: null,
      resourceType: null,
      resourceId: null,
      params: { projectId: input.projectIdOld, projectUrl: input.projectUrlOld },
    });

    expect(emailAdapter.sendTransferRequestConfirmation).toHaveBeenCalledTimes(1);
    expect(emailAdapter.sendTransferRequestConfirmation).toHaveBeenCalledWith(
      testUserEmail,
      input.projectIdOld,
      input.projectUrlOld,
    );
  });

  it("should return bad request error when user email is missing", async () => {
    // Act
    const result = await useCase.execute(testUserId, null, input);

    // Assert
    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("BAD_REQUEST");
    expect(result.error.message).toContain("User account does not have an email address");
  });

  it("should return forbidden error when transfer request already exists", async () => {
    // Mock Databricks to return existing request
    vi.spyOn(databricksAdapter, "executeSqlQuery").mockResolvedValueOnce(
      success({
        columns: [
          { name: "request_id", type_name: "STRING", type_text: "STRING" },
          { name: "user_id", type_name: "STRING", type_text: "STRING" },
          { name: "user_email", type_name: "STRING", type_text: "STRING" },
          { name: "source_platform", type_name: "STRING", type_text: "STRING" },
          { name: "project_id_old", type_name: "STRING", type_text: "STRING" },
          { name: "project_url_old", type_name: "STRING", type_text: "STRING" },
          { name: "status", type_name: "STRING", type_text: "STRING" },
          { name: "requested_at", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
        ],
        rows: [
          [
            "existing-request-id",
            testUserId,
            testUserEmail,
            "photosynq",
            input.projectIdOld,
            input.projectUrlOld,
            "pending",
            new Date().toISOString(),
          ],
        ],
        totalRows: 1,
        truncated: false,
      }),
    );

    // Act
    const result = await useCase.execute(testUserId, testUserEmail, input);

    // Assert
    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
    expect(result.error.message).toContain("You already have a transfer request for this project");
    expect(result.error.message).toContain("Status: pending");
    expect(await notificationsFor(testUserId)).toHaveLength(0);
    expect(emailAdapter.sendTransferRequestConfirmation).not.toHaveBeenCalled();
  });

  it("should succeed even if email sending fails", async () => {
    mockCreatePath();
    vi.spyOn(emailAdapter, "sendTransferRequestConfirmation").mockResolvedValue(
      failure(AppError.internal("Email service unavailable")),
    );

    // Act
    const result = await useCase.execute(testUserId, testUserEmail, input);

    // Assert - should still succeed
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.status).toBe("pending");
    expect(await notificationsFor(testUserId)).toHaveLength(1);
  });

  it("should return internal error when repository fails to create request", async () => {
    vi.spyOn(databricksAdapter, "executeSqlQuery")
      .mockResolvedValueOnce(
        // findExistingRequest - no existing request
        success({ columns: [], rows: [], totalRows: 0, truncated: false }),
      )
      .mockResolvedValueOnce(
        // createTransferRequest - failure
        failure(AppError.internal("Database error")),
      );

    // Act
    const result = await useCase.execute(testUserId, testUserEmail, input);

    // Assert
    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
    expect(await notificationsFor(testUserId)).toHaveLength(0);
  });

  it("should return internal error when checking for existing request fails", async () => {
    vi.spyOn(databricksAdapter, "executeSqlQuery").mockResolvedValueOnce(
      failure(AppError.internal("Database connection failed")),
    );

    // Act
    const result = await useCase.execute(testUserId, testUserEmail, input);

    // Assert
    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });

  it("should still notify when the stored identifier is not an email address", async () => {
    const orcidId = "0000-0002-1825-0097"; // Example ORCID ID (not an email)
    mockCreatePath();

    // Act
    const result = await useCase.execute(testUserId, orcidId, input);

    // Assert - request should still be created successfully
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toMatchObject({
      userId: testUserId,
      userEmail: orcidId,
      sourcePlatform: "photosynq",
      projectIdOld: input.projectIdOld,
      projectUrlOld: input.projectUrlOld,
      status: "pending",
    });
    expect(await notificationsFor(testUserId)).toHaveLength(1);
  });

  it("should still return the request when the notification cannot be stored", async () => {
    mockCreatePath();
    vi.spyOn(testApp.module.get(NotificationRepository), "insertMany").mockResolvedValue(
      failure(AppError.internal("notifications unavailable")),
    );

    // Act
    const result = await useCase.execute(testUserId, testUserEmail, input);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.status).toBe("pending");
    expect(emailAdapter.sendTransferRequestConfirmation).not.toHaveBeenCalled();
  });

  it("should store the notification but send no email when project transfers are switched off", async () => {
    assertSuccess(
      await testApp.module
        .get(NotificationRepository)
        .upsertPreference(testUserId, "project_transfers", "email", false),
    );
    mockCreatePath();

    // Act
    const result = await useCase.execute(testUserId, testUserEmail, input);

    // Assert
    assertSuccess(result);
    expect(await notificationsFor(testUserId)).toHaveLength(1);
    expect(emailAdapter.sendTransferRequestConfirmation).not.toHaveBeenCalled();
  });
});
