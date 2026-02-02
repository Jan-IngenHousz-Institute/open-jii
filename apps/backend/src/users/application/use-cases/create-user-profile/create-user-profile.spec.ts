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
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should create a user profile for an existing user", async () => {
    const dto = {
      firstName: "Alice",
      lastName: "Smith",
      organization: "TestOrg",
    };

    const result = await useCase.execute(dto, testUserId);

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toMatchObject({
      firstName: dto.firstName,
      lastName: dto.lastName,
      organization: dto.organization,
    });
  });

  it("should return NOT_FOUND error when user does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    const dto = {
      firstName: "Bob",
      lastName: "Jones",
      organization: "OtherOrg",
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
      organization: "DataCorp",
    };

    const result = await useCase.execute(dto, testUserId);

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toMatchObject({
      firstName: dto.firstName,
      lastName: dto.lastName,
      bio: dto.bio,
      organization: dto.organization,
    });
  });

  it("should handle error when finding existing profile fails", async () => {
    vi.spyOn(userRepository, "findUserProfile").mockResolvedValue(
      failure(AppError.internal("DB Error")),
    );

    const dto = { firstName: "Test", lastName: "User", organization: "Org" };
    const result = await useCase.execute(dto, testUserId);

    assertFailure(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
  });

  it("should handle error when updating user fails", async () => {
    vi.spyOn(userRepository, "update").mockResolvedValue(
      failure(AppError.internal("DB Update Error")),
    );

    const dto = { firstName: "Test", lastName: "User", organization: "Org" };
    const result = await useCase.execute(dto, testUserId);

    assertFailure(result);
    // The use case masks the error as Not Found for some reason, or returns the failure?
    // Code says: return failure(AppError.notFound(`Cannot update user with ID ${userId}`));
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result.error.message).toContain(`Cannot update user with ID ${testUserId}`);
  });
});
