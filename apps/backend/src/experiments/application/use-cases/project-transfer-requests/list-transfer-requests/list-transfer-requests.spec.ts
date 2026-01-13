import { DatabricksAdapter } from "../../../../../common/modules/databricks/databricks.adapter";
import {
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../../test/test-harness";
import { ListTransferRequestsUseCase } from "./list-transfer-requests";

describe("ListTransferRequests", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let testUserEmail: string;
  let useCase: ListTransferRequestsUseCase;
  let databricksAdapter: DatabricksAdapter;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserEmail = "test@example.com";
    testUserId = await testApp.createTestUser({ email: testUserEmail });

    useCase = testApp.module.get(ListTransferRequestsUseCase);
    databricksAdapter = testApp.module.get(DatabricksAdapter);

    // Reset any mocks before each test
    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should list transfer requests for a user", async () => {
    // Mock Databricks to return transfer requests
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
            "request-id-1",
            testUserId,
            testUserEmail,
            "photosynq",
            "12345",
            "https://photosynq.org/projects/12345",
            "pending",
            "2025-12-15T10:00:00.000Z",
          ],
          [
            "request-id-2",
            testUserId,
            testUserEmail,
            "photosynq",
            "67890",
            "https://photosynq.org/projects/67890",
            "completed",
            "2025-12-14T09:00:00.000Z",
          ],
        ],
        totalRows: 2,
        truncated: false,
      }),
    );

    // Act
    const result = await useCase.execute(testUserId);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toHaveLength(2);
    expect(result.value[0]).toMatchObject({
      requestId: "request-id-1",
      userId: testUserId,
      userEmail: testUserEmail,
      sourcePlatform: "photosynq",
      projectIdOld: "12345",
      projectUrlOld: "https://photosynq.org/projects/12345",
      status: "pending",
    });
    expect(result.value[0].requestedAt).toBeInstanceOf(Date);
  });

  it("should return empty array when user has no transfer requests", async () => {
    // Mock Databricks to return no results
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
        rows: [],
        totalRows: 0,
        truncated: false,
      }),
    );

    // Act
    const result = await useCase.execute(testUserId);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toHaveLength(0);
  });

  it("should list all transfer requests when no user ID provided", async () => {
    // Mock Databricks to return all transfer requests
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
            "request-id-1",
            testUserId,
            testUserEmail,
            "photosynq",
            "12345",
            "https://photosynq.org/projects/12345",
            "pending",
            "2025-12-15T10:00:00.000Z",
          ],
          [
            "request-id-2",
            "other-user-id",
            "other@example.com",
            "photosynq",
            "67890",
            "https://photosynq.org/projects/67890",
            "completed",
            "2025-12-14T09:00:00.000Z",
          ],
        ],
        totalRows: 2,
        truncated: false,
      }),
    );

    // Act
    const result = await useCase.execute();

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toHaveLength(2);
  });

  it("should return internal error when repository fails", async () => {
    // Mock Databricks to fail
    vi.spyOn(databricksAdapter, "executeSqlQuery").mockResolvedValueOnce(
      failure({
        message: "Database connection failed",
        code: "INTERNAL_ERROR",
        statusCode: 500,
        name: "InternalError",
      }),
    );

    // Act
    const result = await useCase.execute(testUserId);

    // Assert
    expect(result.isFailure()).toBe(true);
    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
    expect(result.error.message).toContain("Database connection failed");
  });
});
