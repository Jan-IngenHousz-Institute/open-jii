import { faker } from "@faker-js/faker";

import { eq, users } from "@repo/database";

import { success, failure, AppError } from "../../../../common/utils/fp-utils";
import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import type { DatabricksPort } from "../../../core/ports/databricks.port";
import { DATABRICKS_PORT } from "../../../core/ports/databricks.port";
import { DeleteUserUseCase } from "./delete-user";

describe("DeleteUserUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: DeleteUserUseCase;
  let mockDatabricksPort: DatabricksPort;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    useCase = testApp.module.get(DeleteUserUseCase);

    // Mock Databricks port
    mockDatabricksPort = testApp.module.get(DATABRICKS_PORT);
    vi.spyOn(mockDatabricksPort, "triggerEnrichedTablesRefreshJob").mockResolvedValue(
      success({ run_id: 12345, number_in_job: 1 }),
    );
  });

  afterEach(() => {
    testApp.afterEach();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should successfully soft-delete an existing user", async () => {
    // Arrange
    const userToDeleteId = await testApp.createTestUser({
      email: "to-delete@example.com",
      name: "User ToDelete",
    });

    // Act
    const result = await useCase.execute(userToDeleteId);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toBeUndefined();

    // Verify the user was soft-deleted (PII scrubbed)
    const [deletedUser] = await testApp.database
      .select()
      .from(users)
      .where(eq(users.id, userToDeleteId));

    expect(deletedUser).toBeDefined();
    expect(deletedUser.email).not.toBe("to-delete@example.com"); // Email is anonymized
    expect(deletedUser.email).toMatch(/^deleted-/); // Starts with deleted- prefix
    expect(deletedUser.name).toBe("Deleted User");
  });

  it("should return NOT_FOUND error when user does not exist", async () => {
    // Arrange
    const nonExistentId = "00000000-0000-0000-0000-000000000000";

    // Act
    const result = await useCase.execute(nonExistentId);

    // Assert
    expect(result.isSuccess()).toBe(false);
    expect(result._tag).toBe("failure");
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.message).toContain(`User with ID ${nonExistentId} not found`);
  });

  it("should trigger enriched tables refresh on successful user deletion", async () => {
    // Arrange
    const userToDeleteId = await testApp.createTestUser({
      email: "to-delete@example.com",
      name: "User ToDelete",
    });

    // Act
    const result = await useCase.execute(userToDeleteId);

    // Assert
    expect(result.isSuccess()).toBe(true);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockDatabricksPort.triggerEnrichedTablesRefreshJob).toHaveBeenCalledWith(
      "user_id",
      userToDeleteId,
    );
  });

  it("should continue execution even if Databricks job trigger fails", async () => {
    // Arrange
    const userToDeleteId = await testApp.createTestUser({
      email: "to-delete@example.com",
      name: "User ToDelete",
    });

    // Mock Databricks failure
    const databricksError = AppError.internal("Databricks error");
    vi.spyOn(mockDatabricksPort, "triggerEnrichedTablesRefreshJob").mockResolvedValue(
      failure(databricksError),
    );

    // Act
    const result = await useCase.execute(userToDeleteId);

    // Assert - Should still succeed despite Databricks failure
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toBeUndefined();

    // Verify the user was still soft-deleted
    const [deletedUser] = await testApp.database
      .select()
      .from(users)
      .where(eq(users.id, userToDeleteId));

    expect(deletedUser).toBeDefined();
    expect(deletedUser.email).not.toBe("to-delete@example.com"); // Email is anonymized
    expect(deletedUser.email).toMatch(/^deleted-/); // Starts with deleted- prefix
    expect(deletedUser.name).toBe("Deleted User");
  });

  it("should NOT trigger enriched tables refresh when user deletion fails due to admin check", async () => {
    const nonExistentId = faker.string.uuid();

    const result = await useCase.execute(nonExistentId);

    expect(result.isSuccess()).toBe(false);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockDatabricksPort.triggerEnrichedTablesRefreshJob).not.toHaveBeenCalled();
  });
});
