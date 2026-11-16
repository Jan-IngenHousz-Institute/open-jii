import { eq, experimentDataOutbox, profiles } from "@repo/database";

import { assertFailure, assertSuccess, failure, AppError } from "../../../../common/utils/fp-utils";
import { ExperimentDataOutboxWorker } from "../../../../experiments/application/services/experiment-data-outbox.worker";
import { ExperimentDataOutboxRepository } from "../../../../experiments/core/repositories/experiment-data-outbox.repository";
import { TestHarness } from "../../../../test/test-harness";
import { UserRepository } from "../../../core/repositories/user.repository";
import { CreateUserProfileUseCase } from "./create-user-profile";

describe("CreateUserProfileUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: CreateUserProfileUseCase;
  let userRepository: UserRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(CreateUserProfileUseCase);
    userRepository = testApp.module.get(UserRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should create a user profile for an existing user", async () => {
    const dto = {
      firstName: "Alice",
      lastName: "Smith",
    };

    const result = await useCase.execute(dto, testUserId);

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toMatchObject({
      firstName: dto.firstName,
      lastName: dto.lastName,
    });
  });

  it("should return NOT_FOUND error when user does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const dto = {
      firstName: "Bob",
      lastName: "Jones",
    };

    const result = await useCase.execute(dto, nonExistentId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("should create a user profile with bio", async () => {
    const dto = {
      firstName: "Bob",
      lastName: "Johnson",
      bio: "Experienced data scientist.",
    };

    const result = await useCase.execute(dto, testUserId);

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toMatchObject({
      firstName: dto.firstName,
      lastName: dto.lastName,
      bio: dto.bio,
    });
  });

  it("should handle error when finding existing profile fails", async () => {
    vi.spyOn(userRepository, "findUserProfile").mockResolvedValue(
      failure(AppError.internal("DB Error")),
    );

    const dto = { firstName: "Test", lastName: "User" };
    const result = await useCase.execute(dto, testUserId);

    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });

  it("should handle error when updating user fails", async () => {
    vi.spyOn(userRepository, "update").mockResolvedValue(
      failure(AppError.internal("DB Update Error")),
    );

    const dto = { firstName: "Test", lastName: "User" };
    const result = await useCase.execute(dto, testUserId);

    assertFailure(result);
    // The use case masks the error as Not Found for some reason, or returns the failure?
    // Code says: return failure(AppError.notFound(`Cannot update user with ID ${userId}`));
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.message).toContain(`Cannot update user with ID ${testUserId}`);
  });

  describe("the contributor's lakehouse copy", () => {
    const owed = () => testApp.database.select().from(experimentDataOutbox);
    const profileOf = async (userId: string) => {
      const [profile] = await testApp.database
        .select()
        .from(profiles)
        .where(eq(profiles.userId, userId));
      return profile;
    };

    it.each([
      ["a first profile", { createProfile: false }],
      ["an edit, deactivating it among them", { createProfile: true }],
    ])("is owed %s in the same transaction, and the worker nudged", async (_, user) => {
      const userId = await testApp.createTestUser(user);
      const nudge = vi.spyOn(testApp.module.get(ExperimentDataOutboxWorker), "nudge");

      assertSuccess(
        await useCase.execute({ firstName: "Ada", lastName: "Lovelace", activated: false }, userId),
      );

      expect(await owed()).toEqual([
        expect.objectContaining({
          recordType: "contributor",
          recordId: userId,
          experimentId: null,
          destination: "lakehouse",
        }),
      ]);
      expect(nudge).toHaveBeenCalledTimes(1);
    });

    it("keeps the old name when the copy an edit owes cannot be written", async () => {
      const before = await profileOf(testUserId);
      vi.spyOn(testApp.module.get(ExperimentDataOutboxRepository), "owe").mockRejectedValue(
        new Error("outbox unavailable"),
      );
      const nudge = vi.spyOn(testApp.module.get(ExperimentDataOutboxWorker), "nudge");

      assertFailure(await useCase.execute({ firstName: "Ada", lastName: "Lovelace" }, testUserId));

      expect((await profileOf(testUserId)).firstName).toBe(before.firstName);
      expect(nudge).not.toHaveBeenCalled();
    });

    it("keeps no first profile when the copy it owes cannot be written", async () => {
      const userId = await testApp.createTestUser({ createProfile: false });
      vi.spyOn(testApp.module.get(ExperimentDataOutboxRepository), "owe").mockRejectedValue(
        new Error("outbox unavailable"),
      );

      assertFailure(await useCase.execute({ firstName: "Ada", lastName: "Lovelace" }, userId));

      expect(await profileOf(userId)).toBeUndefined();
    });
  });
});
