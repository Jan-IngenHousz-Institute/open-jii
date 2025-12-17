import { DatabricksAdapter } from "../../../../../common/modules/databricks/databricks.adapter";
import { EmailAdapter } from "../../../../../common/modules/email/services/email.adapter";
import {
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../../test/test-harness";
import { CreateTransferRequestUseCase } from "./create-transfer-request";

describe("CreateTransferRequest", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let testUserEmail: string;
  let useCase: CreateTransferRequestUseCase;
  let databricksAdapter: DatabricksAdapter;
  let emailAdapter: EmailAdapter;

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

    // Reset any mocks before each test
    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should create a transfer request", async () => {
    // Mock Databricks calls
    vi.spyOn(databricksAdapter, "executeSqlQuery")
      .mockResolvedValueOnce(
        // findExistingRequest - no existing request
        success({
          columns: [],
          rows: [],
          totalRows: 0,
          truncated: false,
        }),
      )
      .mockResolvedValueOnce(
        // createTransferRequest - successful insert
        success({
          columns: [],
          rows: [],
          totalRows: 1,
          truncated: false,
        }),
      );

    // Mock email adapter
    vi.spyOn(emailAdapter, "sendTransferRequestConfirmation").mockResolvedValue(success(undefined));

    const input = {
      projectIdOld: "12345",
      projectUrlOld: "https://photosynq.org/projects/12345",
    };

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
  });

  it("should return bad request error when user email is missing", async () => {
    const input = {
      projectIdOld: "12345",
      projectUrlOld: "https://photosynq.org/projects/12345",
    };

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
            "12345",
            "https://photosynq.org/projects/12345",
            "pending",
            new Date().toISOString(),
          ],
        ],
        totalRows: 1,
        truncated: false,
      }),
    );

    const input = {
      projectIdOld: "12345",
      projectUrlOld: "https://photosynq.org/projects/12345",
    };

    // Act
    const result = await useCase.execute(testUserId, testUserEmail, input);

    // Assert
    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
    expect(result.error.message).toContain("You already have a transfer request for this project");
    expect(result.error.message).toContain("Status: pending");
  });

  it("should succeed even if email sending fails", async () => {
    // Mock Databricks calls
    vi.spyOn(databricksAdapter, "executeSqlQuery")
      .mockResolvedValueOnce(
        // findExistingRequest - no existing request
        success({
          columns: [],
          rows: [],
          totalRows: 0,
          truncated: false,
        }),
      )
      .mockResolvedValueOnce(
        // createTransferRequest - successful insert
        success({
          columns: [],
          rows: [],
          totalRows: 1,
          truncated: false,
        }),
      );

    // Mock email adapter to fail
    vi.spyOn(emailAdapter, "sendTransferRequestConfirmation").mockResolvedValue(
      failure({
        message: "Email service unavailable",
        code: "INTERNAL_ERROR",
        statusCode: 500,
        name: "InternalError",
      }),
    );

    const input = {
      projectIdOld: "12345",
      projectUrlOld: "https://photosynq.org/projects/12345",
    };

    // Act
    const result = await useCase.execute(testUserId, testUserEmail, input);

    // Assert - should still succeed
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.status).toBe("pending");
  });

  it("should return internal error when repository fails to create request", async () => {
    // Mock Databricks calls
    vi.spyOn(databricksAdapter, "executeSqlQuery")
      .mockResolvedValueOnce(
        // findExistingRequest - no existing request
        success({
          columns: [],
          rows: [],
          totalRows: 0,
          truncated: false,
        }),
      )
      .mockResolvedValueOnce(
        // createTransferRequest - failure
        failure({
          message: "Database error",
          code: "INTERNAL_ERROR",
          statusCode: 500,
          name: "InternalError",
        }),
      );

    const input = {
      projectIdOld: "12345",
      projectUrlOld: "https://photosynq.org/projects/12345",
    };

    // Act
    const result = await useCase.execute(testUserId, testUserEmail, input);

    // Assert
    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });

  it("should return internal error when checking for existing request fails", async () => {
    // Mock Databricks to fail on findExistingRequest
    vi.spyOn(databricksAdapter, "executeSqlQuery").mockResolvedValueOnce(
      failure({
        message: "Database connection failed",
        code: "INTERNAL_ERROR",
        statusCode: 500,
        name: "InternalError",
      }),
    );

    const input = {
      projectIdOld: "12345",
      projectUrlOld: "https://photosynq.org/projects/12345",
    };

    // Act
    const result = await useCase.execute(testUserId, testUserEmail, input);

    // Assert
    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });
});
