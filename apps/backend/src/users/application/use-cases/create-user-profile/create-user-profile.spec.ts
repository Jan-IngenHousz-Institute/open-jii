import { eq, users, profiles } from "@repo/database";

import { assertFailure, assertSuccess, failure, AppError } from "../../../../common/utils/fp-utils";
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

  it("does not mark registration complete when the profile save fails", async () => {
    const id = await testApp.createTestUser({ createProfile: false, registered: false });
    vi.spyOn(userRepository, "createOrUpdateUserProfile").mockResolvedValue(
      failure(AppError.internal("Save failed")),
    );
    const result = await useCase.execute({ firstName: "New", lastName: "Researcher" }, id);
    assertFailure(result);
    const [user] = await testApp.database.select().from(users).where(eq(users.id, id));
    expect(user.registered).toBe(false);
    expect(
      await testApp.database.select().from(profiles).where(eq(profiles.userId, id)),
    ).toHaveLength(0);
  });

  it("can retry profile saving after the registered update fails", async () => {
    const id = await testApp.createTestUser({ createProfile: false, registered: false });
    vi.spyOn(userRepository, "update").mockResolvedValueOnce(
      failure(AppError.internal("Update failed")),
    );
    const data = { firstName: "New", lastName: "Researcher" };
    assertFailure(await useCase.execute(data, id));
    const [before] = await testApp.database.select().from(users).where(eq(users.id, id));
    expect(before.registered).toBe(false);
    assertSuccess(await useCase.execute(data, id));
    const [after] = await testApp.database.select().from(users).where(eq(users.id, id));
    expect(after.registered).toBe(true);
    expect(
      await testApp.database.select().from(profiles).where(eq(profiles.userId, id)),
    ).toHaveLength(1);
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
});
