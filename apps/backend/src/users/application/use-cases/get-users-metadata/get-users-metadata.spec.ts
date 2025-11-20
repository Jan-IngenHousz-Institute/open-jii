import { faker } from "@faker-js/faker";

import { assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { UserRepository } from "../../../core/repositories/user.repository";
import { GetUsersMetadataUseCase } from "./get-users-metadata";

describe("GetUsersMetadataUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: GetUsersMetadataUseCase;
  let userRepository: UserRepository;
  let testUser1Id: string;
  let testUser2Id: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUser1Id = await testApp.createTestUser({
      email: "user1@example.com",
      name: "John Doe",
    });
    testUser2Id = await testApp.createTestUser({
      email: "user2@example.com",
      name: "Jane Smith",
    });

    useCase = testApp.module.get(GetUsersMetadataUseCase);
    userRepository = testApp.module.get(UserRepository);

    // Create profiles for the test users
    await userRepository.createOrUpdateUserProfile(testUser1Id, {
      firstName: "John",
      lastName: "Doe",
      bio: "Test bio 1",
      activated: true,
    });
    await userRepository.createOrUpdateUserProfile(testUser2Id, {
      firstName: "Jane",
      lastName: "Smith",
      bio: "Test bio 2",
      activated: true,
    });
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should be defined", () => {
    expect(GetUsersMetadataUseCase).toBeDefined();
  });

  it("should return user metadata for valid user IDs", async () => {
    // Act
    const result = await useCase.execute({
      userIds: [testUser1Id, testUser2Id],
    });

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toHaveLength(2);

    // Check first user
    const user1 = result.value.find((u) => u.userId === testUser1Id);
    expect(user1).toBeDefined();
    expect(user1).toMatchObject({
      userId: testUser1Id,
      firstName: "John",
      lastName: "Doe",
      image: null, // No image set in test
    });

    // Check second user
    const user2 = result.value.find((u) => u.userId === testUser2Id);
    expect(user2).toBeDefined();
    expect(user2).toMatchObject({
      userId: testUser2Id,
      firstName: "Jane",
      lastName: "Smith",
      image: null, // No image set in test
    });
  });

  it("should return empty array for empty user IDs array", async () => {
    // Act
    const result = await useCase.execute({
      userIds: [],
    });

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toEqual([]);
  });

  it("should return partial results for mix of valid and invalid user IDs", async () => {
    const invalidUserId = faker.string.uuid();

    // Act
    const result = await useCase.execute({
      userIds: [testUser1Id, invalidUserId, testUser2Id],
    });

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toHaveLength(2); // Only valid users returned

    const userIds = result.value.map((u) => u.userId);
    expect(userIds).toContain(testUser1Id);
    expect(userIds).toContain(testUser2Id);
    expect(userIds).not.toContain(invalidUserId);
  });

  it("should return empty array for all invalid user IDs", async () => {
    const invalidUserIds = [faker.string.uuid(), faker.string.uuid()];

    // Act
    const result = await useCase.execute({
      userIds: invalidUserIds,
    });

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toEqual([]);
  });

  it("should exclude users without profiles (inner join)", async () => {
    // Create a user without a profile
    const userWithoutProfileId = await testApp.createTestUser({
      email: "noprofile@example.com",
      name: "No Profile User",
      createProfile: false, // Don't create profile for this user
    });

    // Act
    const result = await useCase.execute({
      userIds: [userWithoutProfileId],
    });

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toHaveLength(0); // User without profile is excluded by inner join
  });
});
