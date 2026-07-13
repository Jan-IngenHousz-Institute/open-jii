import { StatusCodes } from "http-status-codes";

import { assertFailure, assertSuccess, success } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { CommandRepository } from "../../../core/repositories/command.repository";
import { CreateCommandUseCase } from "./create-command";

describe("CreateCommandUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: CreateCommandUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(CreateCommandUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const commandData = {
    name: "Test Command",
    description: "A test command description",
    code: [{ steps: [{ name: "Step 1", action: "test" }] }],
    family: "multispeq" as const,
  };

  it("should create a command with valid data", async () => {
    // Act
    const result = await useCase.execute(commandData, testUserId);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const createdCommand = result.value;

    // Verify all fields were set correctly
    expect(createdCommand).toMatchObject({
      id: expect.any(String) as string,
      name: commandData.name,
      description: commandData.description,
      code: commandData.code,
      createdBy: testUserId,
    });
  });

  it("should return a 409 conflict error when a command with the same name already exists", async () => {
    // Arrange - Create a command with the same name first
    await useCase.execute(commandData, testUserId);

    // Act - Try to create another command with the same name
    const result = await useCase.execute(commandData, testUserId);

    // Assert
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.CONFLICT);
    expect(result.error.code).toBe("REPOSITORY_DUPLICATE");
  });

  it("should return internal error when create returns no rows", async () => {
    const commandRepository = testApp.module.get(CommandRepository);
    vi.spyOn(commandRepository, "findByName").mockResolvedValue(success(null));
    vi.spyOn(commandRepository, "create").mockResolvedValue(success([]));

    const result = await useCase.execute(commandData, testUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.message).toBe("Failed to create command");
  });
});
