import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api";

import { success, failure, AppError } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";
import { CreateMacroUseCase } from "../application/use-cases/create-macro/create-macro";
import { DeleteMacroUseCase } from "../application/use-cases/delete-macro/delete-macro";
import { GetMacroUseCase } from "../application/use-cases/get-macro/get-macro";
import { ListMacrosUseCase } from "../application/use-cases/list-macros/list-macros";
import { UpdateMacroUseCase } from "../application/use-cases/update-macro/update-macro";
import type { MacroDto, CreateMacroDto, UpdateMacroDto } from "../core/models/macro.model";
import { deriveFilenameFromName } from "../core/models/macro.model";

describe("MacroController", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let createMacroUseCase: CreateMacroUseCase;
  let getMacroUseCase: GetMacroUseCase;
  let listMacrosUseCase: ListMacrosUseCase;
  let updateMacroUseCase: UpdateMacroUseCase;
  let deleteMacroUseCase: DeleteMacroUseCase;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    // Get use case instances for mocking
    createMacroUseCase = testApp.module.get(CreateMacroUseCase);
    getMacroUseCase = testApp.module.get(GetMacroUseCase);
    listMacrosUseCase = testApp.module.get(ListMacrosUseCase);
    updateMacroUseCase = testApp.module.get(UpdateMacroUseCase);
    deleteMacroUseCase = testApp.module.get(DeleteMacroUseCase);

    // Reset any mocks before each test
    vi.restoreAllMocks();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("createMacro", () => {
    it("should successfully create a macro", async () => {
      // Arrange
      const macroData: CreateMacroDto = {
        name: "Test Macro",
        description: "Test Description",
        language: "python",
        code: "cHl0aG9uIGNvZGU=", // base64 encoded "python code"
      };

      const mockMacro: MacroDto = {
        id: faker.string.uuid(),
        name: macroData.name,
        filename: deriveFilenameFromName(macroData.name),
        description: macroData.description ?? "",
        language: macroData.language,
        code: macroData.code,
        createdBy: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdByName: faker.person.fullName(),
      };

      vi.spyOn(createMacroUseCase, "execute").mockResolvedValue(success(mockMacro));

      // Act
      const response = await testApp
        .post(contract.macros.createMacro.path)
        .withAuth(testUserId)
        .send(macroData)
        .expect(StatusCodes.CREATED);

      // Assert
      expect(response.body).toHaveProperty("id");
      expect(response.body).toMatchObject({
        name: macroData.name,
        description: macroData.description,
        language: macroData.language,
        createdBy: testUserId,
      });
    });

    it("should handle validation errors", async () => {
      // Arrange
      const invalidData = {
        // Missing required name field
        description: "Test Description",
        language: "python",
      };

      // Act & Assert
      await testApp
        .post(contract.macros.createMacro.path)
        .withAuth(testUserId)
        .send(invalidData)
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("should handle use case failure", async () => {
      // Arrange
      const macroData: CreateMacroDto = {
        name: "Test Macro",
        description: "Test Description",
        language: "python",
        code: "cHl0aG9uIGNvZGU=",
      };

      vi.spyOn(createMacroUseCase, "execute").mockResolvedValue(
        failure(AppError.internal("Database error")),
      );

      // Act & Assert
      await testApp
        .post(contract.macros.createMacro.path)
        .withAuth(testUserId)
        .send(macroData)
        .expect(StatusCodes.INTERNAL_SERVER_ERROR);
    });

    it("should require authentication", async () => {
      // Arrange
      const macroData = {
        name: "Test Macro",
        description: "Test Description",
        language: "python",
      };

      // Act & Assert
      await testApp
        .post(contract.macros.createMacro.path)
        .send(macroData)
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("getMacro", () => {
    it("should successfully get a macro", async () => {
      // Arrange
      const mockMacro: MacroDto = {
        id: faker.string.uuid(),
        name: "Test Macro",
        filename: deriveFilenameFromName("Test Macro"),
        description: "Test Description",
        language: "python",
        code: "cHl0aG9uIGNvZGU=",
        createdBy: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdByName: "Test User",
      };

      vi.spyOn(getMacroUseCase, "execute").mockResolvedValue(success(mockMacro));

      // Act
      const response = await testApp
        .get(contract.macros.getMacro.path.replace(":id", mockMacro.id))
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      // Assert
      expect(response.body).toMatchObject({
        id: mockMacro.id,
        name: mockMacro.name,
        description: mockMacro.description,
        language: mockMacro.language,
        createdBy: mockMacro.createdBy,
        createdByName: mockMacro.createdByName,
      });
      expect("createdAt" in (response.body as Record<string, unknown>)).toBe(true);
      expect("updatedAt" in (response.body as Record<string, unknown>)).toBe(true);
    });

    it("should handle macro not found", async () => {
      // Arrange
      const macroId = faker.string.uuid();
      vi.spyOn(getMacroUseCase, "execute").mockResolvedValue(
        failure(AppError.notFound("Macro not found")),
      );

      // Act & Assert
      await testApp
        .get(contract.macros.getMacro.path.replace(":id", macroId))
        .withAuth(testUserId)
        .expect(StatusCodes.NOT_FOUND);
    });

    it("should require authentication", async () => {
      // Act & Assert
      await testApp
        .get(contract.macros.getMacro.path.replace(":id", faker.string.uuid()))
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("listMacros", () => {
    it("should successfully list macros", async () => {
      // Arrange
      const mockMacros: MacroDto[] = [
        {
          id: faker.string.uuid(),
          name: "Test Macro 1",
          filename: deriveFilenameFromName("Test Macro 1"),
          description: "Test Description 1",
          language: "python",
          code: "dGVzdCBjb2RlIDE=", // base64 encoded "test code 1"
          createdBy: testUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdByName: "Test User",
        },
        {
          id: faker.string.uuid(),
          name: "Test Macro 2",
          filename: deriveFilenameFromName("Test Macro 2"),
          description: "Test Description 2",
          language: "javascript",
          code: "dGVzdCBjb2RlIDI=", // base64 encoded "test code 2"
          createdBy: testUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdByName: "Test User",
        },
      ];

      vi.spyOn(listMacrosUseCase, "execute").mockResolvedValue(success(mockMacros));

      // Act
      const response = await testApp
        .get(contract.macros.listMacros.path)
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      // Assert
      expect(response.body).toHaveLength(2);
      expect((response.body as Record<string, unknown>[])[0]).toMatchObject({
        name: "Test Macro 1",
        language: "python",
      });
      expect((response.body as Record<string, unknown>[])[1]).toMatchObject({
        name: "Test Macro 2",
        language: "javascript",
      });
    });

    it("should handle query parameters", async () => {
      // Arrange
      vi.spyOn(listMacrosUseCase, "execute").mockResolvedValue(success([]));

      // Act
      await testApp
        .get(contract.macros.listMacros.path)
        .query({ search: "test", language: "python" })
        .withAuth(testUserId)
        .expect(StatusCodes.OK);

      // Assert
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(listMacrosUseCase.execute).toHaveBeenCalledWith({
        search: "test",
        language: "python",
      });
    });

    it("should require authentication", async () => {
      // Act & Assert
      await testApp.get(contract.macros.listMacros.path).expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("updateMacro", () => {
    it("should successfully update a macro", async () => {
      // Arrange
      const macroId = faker.string.uuid();
      const updateData: UpdateMacroDto = {
        name: "Updated Macro",
        description: "Updated Description",
        language: "javascript",
      };

      const mockUpdatedMacro: MacroDto = {
        id: macroId,
        name: "Updated Macro",
        filename: deriveFilenameFromName("Updated Macro"),
        description: "Updated Description",
        language: "javascript",
        code: "dXBkYXRlZCBjb2Rl", // base64 encoded "updated code"
        createdBy: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdByName: "Test User",
      };

      vi.spyOn(updateMacroUseCase, "execute").mockResolvedValue(success(mockUpdatedMacro));

      // Act
      const response = await testApp
        .put(contract.macros.updateMacro.path.replace(":id", macroId))
        .withAuth(testUserId)
        .send(updateData)
        .expect(StatusCodes.OK);

      // Assert
      expect(response.body).toMatchObject({
        id: macroId,
        name: updateData.name,
        description: updateData.description,
        language: updateData.language,
        createdBy: testUserId,
        createdByName: "Test User",
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(updateMacroUseCase.execute).toHaveBeenCalledWith(macroId, updateData);
    });

    it("should handle macro not found", async () => {
      // Arrange
      const macroId = faker.string.uuid();
      const updateData = {
        name: "Updated Macro",
      };

      vi.spyOn(updateMacroUseCase, "execute").mockResolvedValue(
        failure(AppError.notFound("Macro not found")),
      );

      // Act & Assert
      await testApp
        .put(contract.macros.updateMacro.path.replace(":id", macroId))
        .withAuth(testUserId)
        .send(updateData)
        .expect(StatusCodes.NOT_FOUND);
    });

    it("should handle update with code file", async () => {
      // Arrange
      const macroId = faker.string.uuid();
      const updateData = {
        name: "Updated Macro",
        code: "bmV3IGNvZGU=", // base64 encoded "new code"
      };

      const mockUpdatedMacro: MacroDto = {
        id: macroId,
        name: updateData.name,
        filename: deriveFilenameFromName(updateData.name),
        description: "Description",
        language: "python",
        code: "dXBkYXRlZCBjb2RlIHdpdGggZmlsZQ==", // base64 encoded "updated code with file"
        createdBy: testUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdByName: "Test User",
      };

      vi.spyOn(updateMacroUseCase, "execute").mockResolvedValue(success(mockUpdatedMacro));

      // Act
      const response = await testApp
        .put(contract.macros.updateMacro.path.replace(":id", macroId))
        .withAuth(testUserId)
        .send(updateData)
        .expect(StatusCodes.OK);

      // Assert
      expect(response.body).toMatchObject({
        id: macroId,
        name: updateData.name,
        description: "Description",
        language: "python",
        createdBy: testUserId,
        createdByName: "Test User",
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(updateMacroUseCase.execute).toHaveBeenCalledWith(macroId, updateData);
    });

    it("should require authentication", async () => {
      // Act & Assert
      await testApp
        .put(contract.macros.updateMacro.path.replace(":id", faker.string.uuid()))
        .send({ name: "Updated Name" })
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("deleteMacro", () => {
    it("should successfully delete a macro", async () => {
      // Arrange
      const macroId = faker.string.uuid();
      vi.spyOn(deleteMacroUseCase, "execute").mockResolvedValue(success(undefined));

      // Act
      await testApp
        .delete(contract.macros.deleteMacro.path.replace(":id", macroId))
        .withAuth(testUserId)
        .expect(StatusCodes.NO_CONTENT);

      // Assert
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(deleteMacroUseCase.execute).toHaveBeenCalledWith(macroId);
    });

    it("should handle macro not found", async () => {
      // Arrange
      const macroId = faker.string.uuid();
      vi.spyOn(deleteMacroUseCase, "execute").mockResolvedValue(
        failure(AppError.notFound("Macro not found")),
      );

      // Act & Assert
      await testApp
        .delete(contract.macros.deleteMacro.path.replace(":id", macroId))
        .withAuth(testUserId)
        .expect(StatusCodes.NOT_FOUND);
    });

    it("should handle database errors", async () => {
      // Arrange
      const macroId = faker.string.uuid();
      vi.spyOn(deleteMacroUseCase, "execute").mockResolvedValue(
        failure(AppError.internal("Database error")),
      );

      // Act & Assert
      await testApp
        .delete(contract.macros.deleteMacro.path.replace(":id", macroId))
        .withAuth(testUserId)
        .expect(StatusCodes.INTERNAL_SERVER_ERROR);
    });

    it("should require authentication", async () => {
      // Act & Assert
      await testApp
        .delete(contract.macros.deleteMacro.path.replace(":id", faker.string.uuid()))
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("authentication and authorization", () => {
    it("should reject requests without authentication for all endpoints", async () => {
      const macroId = faker.string.uuid();

      // Test all endpoints without auth
      await testApp
        .post(contract.macros.createMacro.path)
        .send({})
        .expect(StatusCodes.UNAUTHORIZED);

      await testApp
        .get(contract.macros.getMacro.path.replace(":id", macroId))
        .expect(StatusCodes.UNAUTHORIZED);

      await testApp.get(contract.macros.listMacros.path).expect(StatusCodes.UNAUTHORIZED);

      await testApp
        .put(contract.macros.updateMacro.path.replace(":id", macroId))
        .send({})
        .expect(StatusCodes.UNAUTHORIZED);

      await testApp
        .delete(contract.macros.deleteMacro.path.replace(":id", macroId))
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });
});
