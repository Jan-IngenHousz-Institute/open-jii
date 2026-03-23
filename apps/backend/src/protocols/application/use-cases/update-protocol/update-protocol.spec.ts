import { faker } from "@faker-js/faker";

import { experimentProtocols } from "@repo/database";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { ProtocolMacroRepository } from "../../../core/repositories/protocol-macro.repository";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";
import { UpdateProtocolUseCase } from "./update-protocol";

describe("UpdateProtocolUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: UpdateProtocolUseCase;
  let protocolRepository: ProtocolRepository;
  let protocolMacroRepository: ProtocolMacroRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(UpdateProtocolUseCase);
    protocolRepository = testApp.module.get(ProtocolRepository);
    protocolMacroRepository = testApp.module.get(ProtocolMacroRepository);
  });

  afterEach(() => {
    testApp.afterEach();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should create a new version with incremented version number", async () => {
    // Arrange
    const protocolData = {
      name: "Test Protocol",
      description: "A test protocol description",
      code: JSON.stringify({ steps: [{ name: "Step 1", action: "test" }] }),
      family: "multispeq" as const,
    };

    const createResult = await protocolRepository.create(protocolData, testUserId);
    assertSuccess(createResult);
    const v1 = createResult.value[0];
    expect(v1.version).toBe(1);

    const updateData = {
      name: "Updated Protocol",
      description: "Updated description",
      code: [{ steps: [{ name: "Updated Step", action: "updated" }] }],
    };

    // Act
    const result = await useCase.execute(v1.id, updateData);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);

    // New version has new ID and version 2
    expect(result.value.id).not.toBe(v1.id);
    expect(result.value.version).toBe(2);
    expect(result.value.name).toBe(updateData.name);
    expect(result.value.description).toBe(updateData.description);
    expect(result.value.createdBy).toBe(testUserId);
  });

  it("should preserve old version unchanged in database", async () => {
    // Arrange
    const protocolData = {
      name: "Immutable Protocol",
      description: "Should not change",
      code: JSON.stringify([{ step: "original" }]),
      family: "multispeq" as const,
    };

    const createResult = await protocolRepository.create(protocolData, testUserId);
    assertSuccess(createResult);
    const v1 = createResult.value[0];

    // Act
    const result = await useCase.execute(v1.id, { description: "New description" });
    assertSuccess(result);

    // Assert - old version is unchanged
    const oldResult = await protocolRepository.findOne(v1.id);
    assertSuccess(oldResult);
    expect(oldResult.value).not.toBeNull();
    expect(oldResult.value!.version).toBe(1);
    expect(oldResult.value!.description).toBe("Should not change");

    // New version has updated data
    expect(result.value.version).toBe(2);
    expect(result.value.description).toBe("New description");
  });

  it("should allow update even when protocol is assigned to an experiment", async () => {
    // Arrange — versioning means we create a NEW version, not mutate the assigned one
    const protocolData = {
      name: "Assigned Protocol",
      description: "Protocol assigned to experiment",
      code: [{ steps: [{ name: "Step 1", action: "test" }] }],
      family: "multispeq" as const,
    };

    const createResult = await protocolRepository.create(protocolData, testUserId);
    assertSuccess(createResult);
    const v1 = createResult.value[0];

    // Create experiment and assign protocol v1
    const { experiment } = await testApp.createExperiment({
      name: "Test Experiment",
      userId: testUserId,
    });
    await testApp.database.insert(experimentProtocols).values({
      protocolId: v1.id,
      experimentId: experiment.id,
    });

    // Act — should succeed now (creates new version, doesn't mutate assigned one)
    const result = await useCase.execute(v1.id, { name: "Updated Protocol v2" });

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.version).toBe(2);
    expect(result.value.id).not.toBe(v1.id);

    // Verify v1 still exists unchanged (experiment still points to it)
    const v1Check = await protocolRepository.findOne(v1.id);
    assertSuccess(v1Check);
    expect(v1Check.value).not.toBeNull();
    expect(v1Check.value!.version).toBe(1);
  });

  it("should carry forward unchanged fields in partial update", async () => {
    // Arrange
    const protocolData = {
      name: "Partial Protocol",
      description: "Original description",
      code: [{ steps: [{ name: "Step 1", action: "test" }] }],
      family: "multispeq" as const,
    };

    const createResult = await protocolRepository.create(protocolData, testUserId);
    assertSuccess(createResult);
    const v1 = createResult.value[0];

    // Act — only update name
    const result = await useCase.execute(v1.id, { name: "Partially Updated Protocol" });

    // Assert
    assertSuccess(result);
    expect(result.value.version).toBe(2);
    expect(result.value.name).toBe("Partially Updated Protocol");
    expect(result.value.description).toBe(protocolData.description); // carried forward
    expect(result.value.family).toBe(protocolData.family); // carried forward
  });

  it("should return not found error for non-existent protocol", async () => {
    const result = await useCase.execute(faker.string.uuid(), { name: "Updated" });

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error).toMatchObject({
      code: "NOT_FOUND",
      message: "Protocol not found",
      statusCode: 404,
    });
  });

  it("should copy compatibility links from old version to new version", async () => {
    // Arrange
    const protocol = await testApp.createProtocol({
      name: "Linked Protocol",
      createdBy: testUserId,
    });
    const macro = await testApp.createMacro({
      name: "Compatible Macro",
      createdBy: testUserId,
    });

    // Add compatibility link
    await protocolMacroRepository.addMacros(protocol.id, [macro.id]);

    // Act
    const result = await useCase.execute(protocol.id, { description: "New version" });
    assertSuccess(result);

    // Assert - new version should have the same compatibility link
    const linksResult = await protocolMacroRepository.listMacros(result.value.id);
    assertSuccess(linksResult);
    expect(linksResult.value).toHaveLength(1);
    expect(linksResult.value[0].macro.id).toBe(macro.id);
  });

  it("should increment version correctly with multiple updates", async () => {
    // Arrange
    const protocolData = {
      name: "Multi Version Protocol",
      description: "v1",
      code: JSON.stringify([{}]),
      family: "multispeq" as const,
    };

    const createResult = await protocolRepository.create(protocolData, testUserId);
    assertSuccess(createResult);
    const v1 = createResult.value[0];

    // Act - create v2
    const v2Result = await useCase.execute(v1.id, { description: "v2" });
    assertSuccess(v2Result);
    expect(v2Result.value.version).toBe(2);

    // Act - create v3 from v2
    const v3Result = await useCase.execute(v2Result.value.id, { description: "v3" });
    assertSuccess(v3Result);
    expect(v3Result.value.version).toBe(3);

    // Assert - all 3 versions exist
    const versionsResult = await protocolRepository.findVersionsByName(protocolData.name);
    assertSuccess(versionsResult);
    expect(versionsResult.value).toHaveLength(3);
    expect(versionsResult.value.map((v) => v.version)).toEqual([3, 2, 1]); // DESC order
  });
});
