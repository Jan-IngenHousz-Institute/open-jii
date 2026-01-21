// use-cases/user/__tests__/get-user-profile.spec.ts
import { users } from "@repo/database";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
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
      organization: "TestOrg",
      bio: "Test bio",
    };
    const createRes = await createProfileUseCase.execute(dto, testUserId);
    expect(createRes.isSuccess()).toBe(true);

    // Act
    const result = await getProfileUseCase.execute(testUserId);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const profile = result.value;

    expect(profile).toMatchObject({
      firstName: dto.firstName,
      lastName: dto.lastName,
      organization: dto.organization,
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
    const result = await getProfileUseCase.execute(userWithoutProfileId);

    // Assert
    expect(result.isSuccess()).toBe(false);
    expect(result._tag).toBe("failure");
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should return NOT_FOUND for a non-existent user id", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";

    const result = await getProfileUseCase.execute(nonExistentId);

    expect(result.isSuccess()).toBe(false);
    expect(result._tag).toBe("failure");
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });
});
