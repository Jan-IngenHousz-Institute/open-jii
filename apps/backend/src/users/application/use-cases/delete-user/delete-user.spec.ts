import { eq, users } from "@repo/database";

import { MailchimpAdapter } from "../../../../common/modules/mailchimp/mailchimp.adapter";
import { ErrorCodes } from "../../../../common/utils/error-codes";
import {
  assertFailure,
  assertSuccess,
  failure,
  AppError,
  success,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { UserRepository } from "../../../core/repositories/user.repository";
import { DeleteUserUseCase } from "./delete-user";

describe("DeleteUserUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: DeleteUserUseCase;
  let userRepository: UserRepository;
  let mailchimp: MailchimpAdapter;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    useCase = testApp.module.get(DeleteUserUseCase);
    userRepository = testApp.module.get(UserRepository);
    mailchimp = testApp.module.get(MailchimpAdapter);
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
    expect(deletedUser.email).not.toBe("to-delete@example.com"); // Email is anonymized
    expect(deletedUser.email).toMatch(/^deleted-/); // Starts with deleted- prefix
    expect(deletedUser.name).toBe("Deleted User");
  });

  it("should permanently delete the newsletter member using the original email", async () => {
    const email = "newsletter-erasure@example.com";
    const userId = await testApp.createTestUser({ email });
    const deleteMember = vi.spyOn(mailchimp, "deleteMember").mockResolvedValue(success(undefined));

    const result = await useCase.execute(userId);

    assertSuccess(result);
    expect(deleteMember).toHaveBeenCalledWith(email);
  });

  it("should complete account deletion when newsletter erasure returns a failure", async () => {
    const email = "newsletter-failure@example.com";
    const userId = await testApp.createTestUser({ email });
    vi.spyOn(mailchimp, "deleteMember").mockResolvedValue(
      failure(AppError.internal("Mailchimp deletion failed", ErrorCodes.MAILCHIMP_DELETE_FAILED)),
    );

    const result = await useCase.execute(userId);

    assertSuccess(result);
    await expectUserToBeAnonymized(userId, email);
  });

  it("should complete account deletion when newsletter erasure throws", async () => {
    const email = "newsletter-throws@example.com";
    const userId = await testApp.createTestUser({ email });
    vi.spyOn(mailchimp, "deleteMember").mockRejectedValue(new Error("Mailchimp unavailable"));

    const result = await useCase.execute(userId);

    assertSuccess(result);
    await expectUserToBeAnonymized(userId, email);
  });

  it("should complete account deletion when Mailchimp is not configured", async () => {
    const email = "newsletter-unconfigured@example.com";
    const userId = await testApp.createTestUser({ email });
    vi.spyOn(mailchimp, "deleteMember").mockResolvedValue(
      failure(
        AppError.internal("Newsletter is not configured", ErrorCodes.MAILCHIMP_NOT_CONFIGURED),
      ),
    );

    const result = await useCase.execute(userId);

    assertSuccess(result);
    await expectUserToBeAnonymized(userId, email);
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

  it("should fail if user is the only admin of an experiment", async () => {
    // 1. Create user
    const userId = await testApp.createTestUser({});

    // 2. Create experiment with this user as creator (default admin)
    await testApp.createExperiment({
      userId,
      name: "User Admin Exp",
    });

    // 3. Try delete
    const result = await useCase.execute(userId);

    // 4. Expect Forbidden
    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
  });

  it("should handle repository deletion failure", async () => {
    const userId = await testApp.createTestUser({});
    const deleteMember = vi.spyOn(mailchimp, "deleteMember");

    // Mock failure
    vi.spyOn(userRepository, "delete").mockResolvedValue(failure(AppError.internal("DB Error")));

    const result = await useCase.execute(userId);

    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
    expect(deleteMember).not.toHaveBeenCalled();
  });

  async function expectUserToBeAnonymized(userId: string, originalEmail: string) {
    const [deletedUser] = await testApp.database.select().from(users).where(eq(users.id, userId));

    expect(deletedUser).toBeDefined();
    expect(deletedUser.email).not.toBe(originalEmail);
    expect(deletedUser.email).toMatch(/^deleted-/);
  }
});
