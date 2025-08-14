import { assertSuccess, assertFailure } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { CreateProtocolUseCase } from "./create-protocol";

describe("CreateProtocolUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: CreateProtocolUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(CreateProtocolUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should create a protocol with valid data", async () => {
    // Arrange
    const protocolData = {
      name: "Test Protocol",
      description: "A test protocol description",
      code: [{ steps: [{ name: "Step 1", action: "test" }] }],
      family: "multispeq" as const,
    };

    // Act
    const result = await useCase.execute(protocolData, testUserId);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const createdProtocol = result.value;

    // Verify all fields were set correctly
    expect(createdProtocol).toMatchObject({
      id: expect.any(String) as string,
      name: protocolData.name,
      description: protocolData.description,
      code: protocolData.code,
      createdBy: testUserId,
    });
  });

  it("should trim leading and trailing whitespace from name", async () => {
    const result = await useCase.execute(
      { name: "   Spaced Protocol   ", description: "trim", code: [], family: "multispeq" },
      testUserId,
    );
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.name).toBe("Spaced Protocol");
  });

  it("should return BAD_REQUEST if name is only whitespace", async () => {
    const result = await useCase.execute(
      { name: "   \t  \n  ", description: "invalid", code: [], family: "multispeq" },
      testUserId,
    );
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.code).toBe("BAD_REQUEST");
    expect(result.error.message).toContain("Protocol name is required");
  });
});
