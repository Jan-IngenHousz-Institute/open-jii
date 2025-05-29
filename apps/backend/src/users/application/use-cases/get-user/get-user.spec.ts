import { assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
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
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(GetUserUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should return a user when found", async () => {
    // Act
    const result = await useCase.execute(testUserId);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const retrievedUser = result.value;
    expect(retrievedUser).not.toBeNull();

    // Verify user properties
    expect(retrievedUser).toMatchObject({
      id: testUserId,
    });
  });

  it("should return NOT_FOUND error when user does not exist", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";

    // Act
    const result = await useCase.execute(nonExistentId);

    // Assert
    expect(result.isSuccess()).toBe(false);
    expect(result._tag).toBe("failure");

    const error = result._tag === "failure" ? result.error : null;
    expect(error?.code).toBe("NOT_FOUND");
  });
});
