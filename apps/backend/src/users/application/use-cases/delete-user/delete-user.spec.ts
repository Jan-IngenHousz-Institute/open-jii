import { eq, SYSTEM_OWNER_ID, users } from "@repo/database";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { DeleteUserUseCase } from "./delete-user";

describe("DeleteUserUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: DeleteUserUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    useCase = testApp.module.get(DeleteUserUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
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
    expect(deletedUser.deletedAt).not.toBeNull();
    expect(deletedUser.email).toBeNull();
    expect(deletedUser.name).toMatch(/^deleted-user-/);
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

  it("should ensure system owner exists before deleting user", async () => {
    // Arrange
    const userToDeleteId = await testApp.createTestUser({
      email: "another-delete@example.com",
      name: "Another User",
    });

    // Act
    const result = await useCase.execute(userToDeleteId);

    // Assert - should succeed, meaning system owner was verified/created
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);

    // Verify system owner exists in the database
    const [systemOwner] = await testApp.database
      .select()
      .from(users)
      .where(eq(users.id, SYSTEM_OWNER_ID));

    expect(systemOwner).toBeDefined();
    expect(systemOwner.name).toBe("System Owner");
  });
});
