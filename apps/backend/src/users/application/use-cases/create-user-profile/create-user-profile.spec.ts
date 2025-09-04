import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { CreateUserProfileUseCase } from "./create-user-profile";

describe("CreateUserProfileUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: CreateUserProfileUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(CreateUserProfileUseCase);
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
});
