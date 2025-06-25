import { assertFailure, assertSuccess, failure, success } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";
import { CreateProtocolUseCase } from "./create-protocol";

describe("CreateProtocolUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: CreateProtocolUseCase;
  let protocolRepository: ProtocolRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(CreateProtocolUseCase);
    protocolRepository = testApp.module.get(ProtocolRepository);
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
});
