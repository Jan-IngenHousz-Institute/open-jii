import { faker } from "@faker-js/faker";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { CommandRepository } from "../../../core/repositories/command.repository";
import { GetCommandUseCase } from "./get-command";

describe("GetCommandUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: GetCommandUseCase;
  let commandRepository: CommandRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(GetCommandUseCase);
    commandRepository = testApp.module.get(CommandRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should retrieve a command by id", async () => {
    // Arrange
    const commandData = {
      name: "Test Command",
      description: "A test command description",
      code: { steps: [{ name: "Step 1", action: "test" }] },
      family: "multispeq" as const,
    };

    // Create a command to retrieve
    const createResult = await commandRepository.create(commandData, testUserId);
    assertSuccess(createResult);
    const createdCommand = createResult.value[0];

    // Act
    const result = await useCase.execute(createdCommand.id);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const command = result.value;

    // Verify all fields were retrieved correctly
    expect(command).toMatchObject({
      id: createdCommand.id,
      name: commandData.name,
      description: commandData.description,
      code: commandData.code,
      createdBy: testUserId,
    });
  });

  it("should return not found error for non-existent command", async () => {
    // Act
    const result = await useCase.execute(faker.string.uuid());

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
