import { EmailVisibilityService } from "../../../../authorization/email-visibility.service";
import { AppError, assertFailure, assertSuccess, failure } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { UserRepository } from "../../../core/repositories/user.repository";
import { GetUserUseCase } from "./get-user";

describe("GetUserUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: GetUserUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({ email: "self@example.com" });
    useCase = testApp.module.get(GetUserUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("returns the caller's own record with their address", async () => {
    const result = await useCase.execute(testUserId, testUserId);

    assertSuccess(result);
    expect(result.value).toMatchObject({ id: testUserId, email: "self@example.com" });
  });

  it("returns a stranger without their address", async () => {
    const strangerId = await testApp.createTestUser({ email: "stranger@example.com" });

    const result = await useCase.execute(testUserId, strangerId);

    assertSuccess(result);
    expect(result.value.id).toBe(strangerId);
    expect(result.value.email).toBeNull();
    expect(JSON.stringify(result.value)).not.toContain("stranger@example.com");
  });

  it("returns a member's address to an admin of their organization", async () => {
    const orgId = await testApp.createOrganization();
    await testApp.addOrganizationMember(orgId, testUserId, "admin");
    const memberId = await testApp.createTestUser({ email: "member@example.com" });
    await testApp.addOrganizationMember(orgId, memberId, "member");

    const result = await useCase.execute(testUserId, memberId);

    assertSuccess(result);
    expect(result.value.email).toBe("member@example.com");
  });

  it("withholds a fellow member's address from a plain member", async () => {
    const orgId = await testApp.createOrganization();
    await testApp.addOrganizationMember(orgId, testUserId, "member");
    const otherId = await testApp.createTestUser({ email: "other@example.com" });
    await testApp.addOrganizationMember(orgId, otherId, "owner");

    const result = await useCase.execute(testUserId, otherId);

    assertSuccess(result);
    expect(result.value.email).toBeNull();
  });

  it.each([
    ["deactivated", { activated: false }],
    ["soft-deleted", { deletedAt: new Date() }],
    ["without a profile", { createProfile: false }],
  ])("answers NOT_FOUND for another user who is %s", async (_label, options) => {
    const targetId = await testApp.createTestUser(options);

    const result = await useCase.execute(testUserId, targetId);

    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("still resolves a deactivated user's own record for them", async () => {
    const deactivatedId = await testApp.createTestUser({ activated: false });

    const result = await useCase.execute(deactivatedId, deactivatedId);

    assertSuccess(result);
    expect(result.value.id).toBe(deactivatedId);
  });

  it("should return NOT_FOUND error when user does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";

    const result = await useCase.execute(testUserId, nonExistentId);

    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it.each(["self", "stranger"])(
    "propagates a failed %s lookup without redacting",
    async (target) => {
      const targetId = target === "self" ? testUserId : await testApp.createTestUser({});
      const repository = testApp.module.get(UserRepository);
      const lookupFailure = failure(AppError.internal("User lookup unavailable"));
      vi.spyOn(
        repository,
        target === "self" ? "findOne" : "findDiscoverable",
      ).mockResolvedValueOnce(lookupFailure);
      const redact = vi.spyOn(testApp.module.get(EmailVisibilityService), "redactOne");

      const result = await useCase.execute(testUserId, targetId);

      assertFailure(result);
      expect(result).toBe(lookupFailure);
      expect(result.error.code).toBe("INTERNAL_ERROR");
      expect(redact).not.toHaveBeenCalled();
    },
  );
});
