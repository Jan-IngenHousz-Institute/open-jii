import { faker } from "@faker-js/faker";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { CommandRepository } from "../../../core/repositories/command.repository";
import { DeleteCommandUseCase } from "./delete-command";

describe("DeleteCommandUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: DeleteCommandUseCase;
  let commandRepository: CommandRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(DeleteCommandUseCase);
    commandRepository = testApp.module.get(CommandRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should delete a command by id", async () => {
    // Arrange
    const commandData = {
      name: "Command to Delete",
      description: "This command will be deleted",
      code: JSON.stringify({ steps: [{ name: "Step 1", action: "test" }] }),
      family: "multispeq" as const,
    };

    // Create a command to delete
    const createResult = await commandRepository.create(commandData, testUserId);
    assertSuccess(createResult);
    const createdCommand = createResult.value[0];

    // Act
    const result = await useCase.execute(createdCommand.id);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const deletedCommand = result.value;

    // Verify the deleted command information is correct
    expect(deletedCommand).toMatchObject({
      id: createdCommand.id,
      name: commandData.name,
    });

    // Verify the command is actually deleted by trying to find it
    const findResult = await commandRepository.findOne(createdCommand.id);
    assertSuccess(findResult);
    expect(findResult.value).toBeNull();
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
