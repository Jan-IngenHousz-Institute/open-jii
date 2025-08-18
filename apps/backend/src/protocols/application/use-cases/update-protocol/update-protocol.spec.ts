import { faker } from "@faker-js/faker";

import { experimentProtocols } from "@repo/database";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";
import { UpdateProtocolUseCase } from "./update-protocol";

describe("UpdateProtocolUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: UpdateProtocolUseCase;
  let protocolRepository: ProtocolRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(UpdateProtocolUseCase);
    protocolRepository = testApp.module.get(ProtocolRepository);
  });

  afterEach(() => {
    testApp.afterEach();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should return forbidden error if protocol is assigned to an experiment", async () => {
    // Arrange
    const protocolData = {
      name: "Assigned Protocol",
      description: "Protocol assigned to experiment",
      code: [{ steps: [{ name: "Step 1", action: "test" }] }],
      family: "multispeq" as const,
    };
    // Create protocol
    const createResult = await protocolRepository.create(protocolData, testUserId);
    assertSuccess(createResult);
    const createdProtocol = createResult.value[0];

    // Create experiment and assign protocol
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      userId: testUserId,
    });
    await testApp.database.insert(experimentProtocols).values({
      protocolId: createdProtocol.id,
      experimentId: experiment.id,
    });

    // Try to update
    const updateData = {
      name: "Should Not Update",
    };
    const result = await useCase.execute(createdProtocol.id, updateData);

    // Assert
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error).toMatchObject({
      code: "FORBIDDEN",
      message: "Cannot update protocol assigned to an experiment",
      statusCode: 403,
    });
  });

  it("should update a protocol with valid data", async () => {
    // Arrange
    const protocolData = {
      name: "Test Protocol",
      description: "A test protocol description",
      code: JSON.stringify({ steps: [{ name: "Step 1", action: "test" }] }),
      family: "multispeq" as const,
    };

    // Create a protocol to update
    const createResult = await protocolRepository.create(protocolData, testUserId);
    assertSuccess(createResult);
    const createdProtocol = createResult.value[0];

    const updateData = {
      name: "Updated Protocol",
      description: "Updated description",
      code: [{ steps: [{ name: "Updated Step", action: "updated" }] }],
    };

    // Act
    const result = await useCase.execute(createdProtocol.id, updateData);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const updatedProtocol = result.value;

    // Verify all fields were updated correctly
    expect(updatedProtocol).toMatchObject({
      id: createdProtocol.id,
      name: updateData.name,
      description: updateData.description,
      code: updateData.code,
      createdBy: testUserId,
    });
  });

  it("should update a protocol with partial data", async () => {
    // Arrange
    const protocolData = {
      name: "Test Protocol",
      description: "A test protocol description",
      code: [{ steps: [{ name: "Step 1", action: "test" }] }],
      family: "multispeq" as const,
    };

    // Create a protocol to update
    const createResult = await protocolRepository.create(protocolData, testUserId);
    assertSuccess(createResult);
    const createdProtocol = createResult.value[0];

    // Only update the name
    const updateData = {
      name: "Partially Updated Protocol",
    };

    // Act
    const result = await useCase.execute(createdProtocol.id, updateData);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const updatedProtocol = result.value;

    // Verify name was updated, but other fields remain unchanged
    expect(updatedProtocol).toMatchObject({
      id: createdProtocol.id,
      name: updateData.name,
      description: protocolData.description,
      code: protocolData.code,
      createdBy: testUserId,
    });
  });

  it("should return not found error for non-existent protocol", async () => {
    // Arrange
    const updateData = {
      name: "Updated Protocol",
    };

    // Act
    const result = await useCase.execute(faker.string.uuid(), updateData);

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
