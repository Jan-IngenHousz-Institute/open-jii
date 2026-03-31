import { StatusCodes } from "http-status-codes";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
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
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const protocolData = {
    name: "Test Protocol",
    description: "A test protocol description",
    code: [{ steps: [{ name: "Step 1", action: "test" }] }],
    family: "multispeq" as const,
  };

  it("should create a protocol with valid data", async () => {
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

  it("should return a 409 conflict error when a protocol with the same name already exists", async () => {
    // Arrange - Create a protocol with the same name first
    await useCase.execute(protocolData, testUserId);

    // Act - Try to create another protocol with the same name
    const result = await useCase.execute(protocolData, testUserId);

    // Assert
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.CONFLICT);
    expect(result.error.message).toBe("A protocol with this name already exists");
  });
});
