import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import type { CommandMacroList } from "@repo/api/schemas/command.schema";
import { macros } from "@repo/database";

import { AppError, failure } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";
import type { SuperTestResponse } from "../../test/test-harness";
import { CreateCommandUseCase } from "../application/use-cases/create-command/create-command";
import { CommandMacroRepository } from "../core/repositories/command-macro.repository";

describe("CommandController – createCommand", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let createCommandUseCase: CreateCommandUseCase;

  beforeAll(async () => {
    await testApp.setup({ mock: { AnalyticsAdapter: true } });
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    createCommandUseCase = testApp.module.get(CreateCommandUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should return 409 when a command with the same name already exists", async () => {
    // Arrange
    const commandData = {
      name: "Test Command",
      description: "A test command description",
      code: [{ steps: [{ name: "Step 1", action: "test" }] }],
      family: "multispeq",
    };

    vi.spyOn(createCommandUseCase, "execute").mockResolvedValue(
      failure(AppError.conflict("A command with this name already exists")),
    );

    // Act
    const response = await testApp
      .post(contract.commands.createCommand.path)
      .withAuth(testUserId)
      .send(commandData)
      .expect(StatusCodes.CONFLICT);

    // Assert
    expect(response.body).toMatchObject({
      message: "A command with this name already exists",
    });
  });
});

describe("CommandController – command-macro endpoints", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let commandMacroRepository: CommandMacroRepository;

  beforeAll(async () => {
    await testApp.setup({ mock: { AnalyticsAdapter: true } });
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    commandMacroRepository = testApp.module.get(CommandMacroRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  // Helper to create a macro for tests
  async function createTestMacro(userId: string) {
    const [macro] = await testApp.database
      .insert(macros)
      .values({
        name: `ctrl-macro-${faker.string.alphanumeric(8)}`,
        filename: `macro_${faker.string.alphanumeric(8)}`,
        description: "controller test macro",
        language: "python",
        code: btoa("print('hello')"),
        createdBy: userId,
      })
      .returning();
    return macro;
  }

  describe("listCompatibleMacros", () => {
    it("should return 200 with linked macros", async () => {
      const command = await testApp.createCommand({
        name: "List Macros Command",
        createdBy: testUserId,
      });

      const macro1 = await createTestMacro(testUserId);
      const macro2 = await createTestMacro(testUserId);
      await commandMacroRepository.addMacros(command.id, [macro1.id, macro2.id]);

      const path = testApp.resolvePath(contract.commands.listCompatibleMacros.path, {
        id: command.id,
      });

      const response: SuperTestResponse<CommandMacroList> = await testApp
        .get(path)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);
      expect(response.body).toHaveLength(2);

      const macroIds = response.body.map((e) => e.macro.id);
      expect(macroIds).toContain(macro1.id);
      expect(macroIds).toContain(macro2.id);
    });

    it("should return 200 with empty array when no macros linked", async () => {
      const command = await testApp.createCommand({
        name: "Empty Macros Command",
        createdBy: testUserId,
      });

      const path = testApp.resolvePath(contract.commands.listCompatibleMacros.path, {
        id: command.id,
      });

      const response = await testApp.get(path).withAuth(testUserId).expect(StatusCodes.OK);
      expect(response.body).toHaveLength(0);
    });

    it("should return 401 without auth", async () => {
      const command = await testApp.createCommand({
        name: "Unauth List Command",
        createdBy: testUserId,
      });

      const path = testApp.resolvePath(contract.commands.listCompatibleMacros.path, {
        id: command.id,
      });

      await testApp.get(path).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });

    it("should return 404 for unknown command", async () => {
      const nonExistentId = faker.string.uuid();
      const path = testApp.resolvePath(contract.commands.listCompatibleMacros.path, {
        id: nonExistentId,
      });

      await testApp.get(path).withAuth(testUserId).expect(StatusCodes.NOT_FOUND);
    });
  });

  describe("addCompatibleMacros", () => {
    it("should return 201 with valid body", async () => {
      const command = await testApp.createCommand({
        name: "Add Macros Controller Command",
        createdBy: testUserId,
      });

      const macro = await createTestMacro(testUserId);

      const path = testApp.resolvePath(contract.commands.addCompatibleMacros.path, {
        id: command.id,
      });

      const response: SuperTestResponse<CommandMacroList> = await testApp
        .post(path)
        .withAuth(testUserId)
        .send({ macroIds: [macro.id] })
        .expect(StatusCodes.CREATED);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].macro.id).toBe(macro.id);
    });

    it("should return 401 without auth", async () => {
      const command = await testApp.createCommand({
        name: "Unauth Add Command",
        createdBy: testUserId,
      });

      const macro = await createTestMacro(testUserId);

      const path = testApp.resolvePath(contract.commands.addCompatibleMacros.path, {
        id: command.id,
      });

      await testApp
        .post(path)
        .withoutAuth()
        .send({ macroIds: [macro.id] })
        .expect(StatusCodes.UNAUTHORIZED);
    });

    it("should return 403 for non-creator", async () => {
      const command = await testApp.createCommand({
        name: "Forbidden Add Command",
        createdBy: testUserId,
      });

      const otherUserId = await testApp.createTestUser({ email: "other-ctrl@example.com" });
      const macro = await createTestMacro(testUserId);

      const path = testApp.resolvePath(contract.commands.addCompatibleMacros.path, {
        id: command.id,
      });

      await testApp
        .post(path)
        .withAuth(otherUserId)
        .send({ macroIds: [macro.id] })
        .expect(StatusCodes.FORBIDDEN);
    });

    it("should return 404 for unknown command", async () => {
      const nonExistentId = faker.string.uuid();
      const macro = await createTestMacro(testUserId);

      const path = testApp.resolvePath(contract.commands.addCompatibleMacros.path, {
        id: nonExistentId,
      });

      await testApp
        .post(path)
        .withAuth(testUserId)
        .send({ macroIds: [macro.id] })
        .expect(StatusCodes.NOT_FOUND);
    });
  });

  describe("removeCompatibleMacro", () => {
    it("should return 204 on successful removal", async () => {
      const command = await testApp.createCommand({
        name: "Remove Macro Controller Command",
        createdBy: testUserId,
      });

      const macro = await createTestMacro(testUserId);
      await commandMacroRepository.addMacros(command.id, [macro.id]);

      const path = testApp.resolvePath(contract.commands.removeCompatibleMacro.path, {
        id: command.id,
        macroId: macro.id,
      });

      await testApp.delete(path).withAuth(testUserId).expect(StatusCodes.NO_CONTENT);

      // Verify it was actually removed
      const listPath = testApp.resolvePath(contract.commands.listCompatibleMacros.path, {
        id: command.id,
      });
      const listResponse = await testApp.get(listPath).withAuth(testUserId).expect(StatusCodes.OK);
      expect(listResponse.body).toHaveLength(0);
    });

    it("should return 401 without auth", async () => {
      const command = await testApp.createCommand({
        name: "Unauth Remove Command",
        createdBy: testUserId,
      });

      const macro = await createTestMacro(testUserId);
      await commandMacroRepository.addMacros(command.id, [macro.id]);

      const path = testApp.resolvePath(contract.commands.removeCompatibleMacro.path, {
        id: command.id,
        macroId: macro.id,
      });

      await testApp.delete(path).withoutAuth().expect(StatusCodes.UNAUTHORIZED);
    });

    it("should return 403 for non-creator", async () => {
      const command = await testApp.createCommand({
        name: "Forbidden Remove Controller Command",
        createdBy: testUserId,
      });

      const otherUserId = await testApp.createTestUser({ email: "other-remove-ctrl@example.com" });
      const macro = await createTestMacro(testUserId);
      await commandMacroRepository.addMacros(command.id, [macro.id]);

      const path = testApp.resolvePath(contract.commands.removeCompatibleMacro.path, {
        id: command.id,
        macroId: macro.id,
      });

      await testApp.delete(path).withAuth(otherUserId).expect(StatusCodes.FORBIDDEN);
    });

    it("should return 404 for unknown command", async () => {
      const nonExistentId = faker.string.uuid();
      const fakeMacroId = faker.string.uuid();

      const path = testApp.resolvePath(contract.commands.removeCompatibleMacro.path, {
        id: nonExistentId,
        macroId: fakeMacroId,
      });

      await testApp.delete(path).withAuth(testUserId).expect(StatusCodes.NOT_FOUND);
    });
  });
});
