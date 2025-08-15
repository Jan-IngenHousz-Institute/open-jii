import { faker } from "@faker-js/faker";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";
import { GetProtocolUseCase } from "./get-protocol";

describe("GetProtocolUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: GetProtocolUseCase;
  let protocolRepository: ProtocolRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(GetProtocolUseCase);
    protocolRepository = testApp.module.get(ProtocolRepository);
  });

  afterEach(() => {
    testApp.afterEach();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should retrieve a protocol by id", async () => {
    // Arrange
    const protocolData = {
      name: "Test Protocol",
      description: "A test protocol description",
      code: { steps: [{ name: "Step 1", action: "test" }] },
      family: "multispeq" as const,
    };

    // Create a protocol to retrieve
    const createResult = await protocolRepository.create(protocolData, testUserId);
    assertSuccess(createResult);
    const createdProtocol = createResult.value[0];

    // Act
    const result = await useCase.execute(createdProtocol.id);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const protocol = result.value;

    // Verify all fields were retrieved correctly
    expect(protocol).toMatchObject({
      id: createdProtocol.id,
      name: protocolData.name,
      description: protocolData.description,
      code: protocolData.code,
      createdBy: testUserId,
    });
  });

  it("should return not found error for non-existent protocol", async () => {
    // Act
    const result = await useCase.execute(faker.string.uuid());

    // Assert
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error).toMatchObject({
      code: "NOT_FOUND",
      message: "Protocol not found",
      statusCode: 404,
    });
  });
});
