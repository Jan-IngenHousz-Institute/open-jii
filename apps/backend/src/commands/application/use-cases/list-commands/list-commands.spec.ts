import { assertFailure, assertSuccess, failure } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { CommandRepository } from "../../../core/repositories/command.repository";
import { ListCommandsUseCase } from "./list-commands";

describe("ListCommandsUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: ListCommandsUseCase;
  let commandRepository: CommandRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(ListCommandsUseCase);
    commandRepository = testApp.module.get(CommandRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should list all commands without filter", async () => {
    // Arrange
    const command1 = {
      name: "Command 1",
      description: "Description 1",
      code: JSON.stringify({ steps: [{ name: "Step 1", action: "test" }] }),
      family: "multispeq" as const,
    };

    const command2 = {
      name: "Command 2",
      description: "Description 2",
      code: JSON.stringify({ steps: [{ name: "Step 2", action: "test" }] }),
      family: "multispeq" as const,
    };

    // Create test commands
    await commandRepository.create(command1, testUserId);
    await commandRepository.create(command2, testUserId);

    // Act
    const result = await useCase.execute();

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const commands = result.value;

    // Should find at least the two commands we created
    expect(commands.length).toBeGreaterThanOrEqual(2);
    expect(commands.some((p) => p.name === command1.name)).toBe(true);
    expect(commands.some((p) => p.name === command2.name)).toBe(true);
  });

  it("should filter commands by search term", async () => {
    // Arrange
    const uniquePrefix = "UniqueTest";
    const command1 = {
      name: `${uniquePrefix} Command 1`,
      description: "Description 1",
      code: JSON.stringify({ steps: [{ name: "Step 1", action: "test" }] }),
      family: "multispeq" as const,
    };

    const command2 = {
      name: "Different Command 2",
      description: "Description 2",
      code: JSON.stringify({ steps: [{ name: "Step 2", action: "test" }] }),
      family: "multispeq" as const,
    };

    // Create test commands
    await commandRepository.create(command1, testUserId);
    await commandRepository.create(command2, testUserId);

    // Act
    const result = await useCase.execute(uniquePrefix);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const commands = result.value;

    // Should only find the command with the unique prefix
    expect(commands.some((p) => p.name === command1.name)).toBe(true);
    expect(commands.every((p) => p.name !== command2.name)).toBe(true);
  });

  it("should handle repository failures", async () => {
    // Arrange
    // Mock repository to fail
    vi.spyOn(commandRepository, "findAll").mockResolvedValue(
      failure({
        name: "RepositoryError",
        code: "INTERNAL_ERROR",
        message: "Repository error",
        statusCode: 500,
      }),
    );

    // Act
    const result = await useCase.execute();

    // Assert
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error).toMatchObject({
      name: "RepositoryError",
      code: "INTERNAL_ERROR",
      message: "Repository error",
      statusCode: 500,
    });
  });
});
