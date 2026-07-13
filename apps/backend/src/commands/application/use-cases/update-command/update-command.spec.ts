import { faker } from "@faker-js/faker";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { CommandRepository } from "../../../core/repositories/command.repository";
import { UpdateCommandUseCase } from "./update-command";

describe("UpdateCommandUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: UpdateCommandUseCase;
  let commandRepository: CommandRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(UpdateCommandUseCase);
    commandRepository = testApp.module.get(CommandRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should update a command with valid data", async () => {
    // Arrange
    const commandData = {
      name: "Test Command",
      description: "A test command description",
      code: JSON.stringify({ steps: [{ name: "Step 1", action: "test" }] }),
      family: "multispeq" as const,
    };

    // Create a command to update
    const createResult = await commandRepository.create(commandData, testUserId);
    assertSuccess(createResult);
    const createdCommand = createResult.value[0];

    const updateData = {
      name: "Updated Command",
      description: "Updated description",
      code: [{ steps: [{ name: "Updated Step", action: "updated" }] }],
    };

    // Act
    const result = await useCase.execute(createdCommand.id, updateData);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const updatedCommand = result.value;

    // Verify all fields were updated correctly
    expect(updatedCommand).toMatchObject({
      id: createdCommand.id,
      name: updateData.name,
      description: updateData.description,
      code: updateData.code,
      createdBy: testUserId,
    });
  });

  it("should update a command with partial data", async () => {
    // Arrange
    const commandData = {
      name: "Test Command",
      description: "A test command description",
      code: [{ steps: [{ name: "Step 1", action: "test" }] }],
      family: "multispeq" as const,
    };

    // Create a command to update
    const createResult = await commandRepository.create(commandData, testUserId);
    assertSuccess(createResult);
    const createdCommand = createResult.value[0];

    // Only update the name
    const updateData = {
      name: "Partially Updated Command",
    };

    // Act
    const result = await useCase.execute(createdCommand.id, updateData);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const updatedCommand = result.value;

    // Verify name was updated, but other fields remain unchanged
    expect(updatedCommand).toMatchObject({
      id: createdCommand.id,
      name: updateData.name,
      description: commandData.description,
      code: commandData.code,
      createdBy: testUserId,
    });
  });

  it("should return not found error for non-existent command", async () => {
    // Arrange
    const updateData = {
      name: "Updated Command",
    };

    // Act
    const result = await useCase.execute(faker.string.uuid(), updateData);

    // Assert
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error).toMatchObject({
      code: "NOT_FOUND",
      message: "Command not found",
      statusCode: 404,
    });
  });
});
