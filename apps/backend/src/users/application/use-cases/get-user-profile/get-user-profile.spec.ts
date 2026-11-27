// use-cases/user/__tests__/get-user-profile.spec.ts
import { accounts, users } from "@repo/database";

import { AppError, assertFailure, assertSuccess, failure } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { UserRepository } from "../../../core/repositories/user.repository";
import { CreateUserProfileUseCase } from "../create-user-profile/create-user-profile";
import { GetUserProfileUseCase } from "./get-user-profile";

describe("GetUserProfileUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let getProfileUseCase: GetUserProfileUseCase;
  let createProfileUseCase: CreateUserProfileUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    getProfileUseCase = testApp.module.get(GetUserProfileUseCase);
    createProfileUseCase = testApp.module.get(CreateUserProfileUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should return a user profile when it exists", async () => {
    // Arrange: create a profile for the test user
    const dto = {
      firstName: "Alice",
      lastName: "Smith",
      bio: "Test bio",
    };
    const createRes = await createProfileUseCase.execute(dto, testUserId);
    expect(createRes.isSuccess()).toBe(true);

    // Act
    const result = await getProfileUseCase.execute(testUserId, testUserId);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const profile = result.value;

    expect(profile).toMatchObject({
      firstName: dto.firstName,
      lastName: dto.lastName,
      bio: dto.bio,
    });
  });

  it("should return NOT_FOUND when no profile exists for the user", async () => {
    // Arrange: create a different user with no profile
    const [userWithoutProfile] = await testApp.database
      .insert(users)
      .values({
        email: "no-profile@example.com",
        name: "No Profile",
        emailVerified: false,
        registered: false,
      })
      .returning();
    const userWithoutProfileId = userWithoutProfile.id;

    // Act
    const result = await getProfileUseCase.execute(userWithoutProfileId, testUserId);

    // Assert
    expect(result.isSuccess()).toBe(false);
    expect(result._tag).toBe("failure");
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should return NOT_FOUND for a non-existent user id", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";

    const result = await getProfileUseCase.execute(nonExistentId, testUserId);

    expect(result.isSuccess()).toBe(false);
    expect(result._tag).toBe("failure");
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  describe("the ORCID iD", () => {
    const orcidId = "0000-0002-1825-0097";

    beforeEach(async () => {
      const created = await createProfileUseCase.execute(
        { firstName: "Amara", lastName: "Okafor" },
        testUserId,
      );
      assertSuccess(created);
    });

    const connectOrcid = () =>
      testApp.database
        .insert(accounts)
        .values({ userId: testUserId, providerId: "orcid", accountId: orcidId });

    it("is returned to the owner with ORCID connected", async () => {
      await connectOrcid();

      const result = await getProfileUseCase.execute(testUserId, testUserId);

      assertSuccess(result);
      expect(result.value).toMatchObject({ firstName: "Amara", orcidId });
    });

    it("is null for the owner without ORCID", async () => {
      const result = await getProfileUseCase.execute(testUserId, testUserId);

      assertSuccess(result);
      expect(result.value.orcidId).toBeNull();
    });

    it("is null for another viewer, without reading it", async () => {
      await connectOrcid();
      const viewerId = await testApp.createTestUser({});
      const findOrcidId = vi.spyOn(testApp.module.get(UserRepository), "findOrcidId");

      const result = await getProfileUseCase.execute(testUserId, viewerId);

      assertSuccess(result);
      expect(result.value).toMatchObject({ firstName: "Amara", orcidId: null });
      expect(findOrcidId).not.toHaveBeenCalled();
    });

    it("fails the read when the iD cannot be read", async () => {
      await connectOrcid();
      vi.spyOn(testApp.module.get(UserRepository), "findOrcidId").mockResolvedValueOnce(
        failure(AppError.internal("accounts unavailable")),
      );

      const result = await getProfileUseCase.execute(testUserId, testUserId);

      assertFailure(result);
      expect(result.error.code).toBe("INTERNAL_ERROR");
    });
  });
});
