import { faker } from "@faker-js/faker";
import { StatusCodes } from "http-status-codes";

import { FEATURE_FLAGS } from "@repo/analytics";
import { contract } from "@repo/api";

import { AnalyticsAdapter } from "../../common/modules/analytics/analytics.adapter";
import { success, failure, AppError } from "../../common/utils/fp-utils";
import type { MockAnalyticsAdapter } from "../../test/mocks/adapters/analytics.adapter.mock";
import { TestHarness } from "../../test/test-harness";
import { CreateMacroUseCase } from "../application/use-cases/create-macro/create-macro";
import { DeleteMacroUseCase } from "../application/use-cases/delete-macro/delete-macro";
import { GetMacroUseCase } from "../application/use-cases/get-macro/get-macro";
import { ListMacrosUseCase } from "../application/use-cases/list-macros/list-macros";
import { UpdateMacroUseCase } from "../application/use-cases/update-macro/update-macro";
import type { MacroDto, CreateMacroDto, UpdateMacroDto } from "../core/models/macro.model";
import { generateHashedFilename } from "../core/models/macro.model";

describe("MacroController", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let analyticsAdapter: MockAnalyticsAdapter;
  let createMacroUseCase: CreateMacroUseCase;
  let getMacroUseCase: GetMacroUseCase;
  let listMacrosUseCase: ListMacrosUseCase;
  let updateMacroUseCase: UpdateMacroUseCase;
  let deleteMacroUseCase: DeleteMacroUseCase;

  beforeAll(async () => {
    await testApp.setup({ mock: { AnalyticsAdapter: true } });
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});

    // Get use case instances for mocking
    analyticsAdapter = testApp.module.get(AnalyticsAdapter);
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

      const macroId = faker.string.uuid();

      const mockMacro: MacroDto = {
        id: macroId,
        name: macroData.name,
        filename: generateHashedFilename(macroId),
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
        .withoutAuth()
        .send(macroData)
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("getMacro", () => {
    it("should successfully get a macro", async () => {
      // Arrange
      const macroId = faker.string.uuid();
      const mockMacro: MacroDto = {
        id: macroId,
        name: "Test Macro",
        filename: generateHashedFilename(macroId),
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
        .withoutAuth()
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });

  describe("listMacros", () => {
    it("should successfully list macros", async () => {
      // Arrange

      const macroIds = [faker.string.uuid(), faker.string.uuid()];
      const mockMacros: MacroDto[] = [
        {
          id: macroIds[0],
          name: "Test Macro 1",
          filename: generateHashedFilename(macroIds[0]),
          description: "Test Description 1",
          language: "python",
          code: "dGVzdCBjb2RlIDE=", // base64 encoded "test code 1"
          createdBy: testUserId,
          createdAt: new Date(),
          updatedAt: new Date(),
          createdByName: "Test User",
        },
        {
          id: macroIds[1],
          name: "Test Macro 2",
          filename: generateHashedFilename(macroIds[1]),
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
      await testApp
        .get(contract.macros.listMacros.path)
        .withoutAuth()
        .expect(StatusCodes.UNAUTHORIZED);
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
        filename: generateHashedFilename(macroId),
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
      expect(updateMacroUseCase.execute).toHaveBeenCalledWith(macroId, updateData, testUserId);
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
        filename: generateHashedFilename(macroId),
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
      expect(updateMacroUseCase.execute).toHaveBeenCalledWith(macroId, updateData, testUserId);
    });

    it("should require authentication", async () => {
      // Act & Assert
      await testApp
        .put(contract.macros.updateMacro.path.replace(":id", faker.string.uuid()))
        .withoutAuth()
        .send({ name: "Updated Name" })
        .expect(StatusCodes.UNAUTHORIZED);
    });

    it("should handle forbidden when user is not the creator", async () => {
      // Arrange
      const macroId = faker.string.uuid();
      const updateData = {
        name: "Trying to Update",
      };

      vi.spyOn(updateMacroUseCase, "execute").mockResolvedValue(
        failure(AppError.forbidden("Only the macro creator can update this macro")),
      );

      // Act & Assert
      await testApp
        .put(contract.macros.updateMacro.path.replace(":id", macroId))
        .withAuth(testUserId)
        .send(updateData)
        .expect(StatusCodes.FORBIDDEN);
    });
  });

  describe("deleteMacro", () => {
    beforeEach(() => {
      analyticsAdapter.setFlag(FEATURE_FLAGS.MACRO_DELETION, true);
    });

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
      expect(deleteMacroUseCase.execute).toHaveBeenCalledWith(macroId, testUserId);
    });

    it("should return 403 if macro deletion is disabled", async () => {
      // Override mock to disable feature flag
      analyticsAdapter.setFlag(FEATURE_FLAGS.MACRO_DELETION, false);

      const macroId = faker.string.uuid();

      await testApp
        .delete(contract.macros.deleteMacro.path.replace(":id", macroId))
        .withAuth(testUserId)
        .expect(StatusCodes.FORBIDDEN);
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
        .withoutAuth()
        .expect(StatusCodes.UNAUTHORIZED);
    });

    it("should handle forbidden when user is not the creator", async () => {
      // Arrange
      const macroId = faker.string.uuid();
      vi.spyOn(deleteMacroUseCase, "execute").mockResolvedValue(
        failure(AppError.forbidden("Only the macro creator can delete this macro")),
      );

      // Act & Assert
      await testApp
        .delete(contract.macros.deleteMacro.path.replace(":id", macroId))
        .withAuth(testUserId)
        .expect(StatusCodes.FORBIDDEN);
    });
  });

  describe("authentication and authorization", () => {
    it("should reject requests without authentication for all endpoints", async () => {
      const macroId = faker.string.uuid();

      // Test all endpoints without auth
      await testApp
        .post(contract.macros.createMacro.path)
        .withoutAuth()
        .send({})
        .expect(StatusCodes.UNAUTHORIZED);

      await testApp
        .get(contract.macros.getMacro.path.replace(":id", macroId))
        .withoutAuth()
        .expect(StatusCodes.UNAUTHORIZED);

      await testApp
        .get(contract.macros.listMacros.path)
        .withoutAuth()
        .expect(StatusCodes.UNAUTHORIZED);

      await testApp
        .put(contract.macros.updateMacro.path.replace(":id", macroId))
        .withoutAuth()
        .send({})
        .expect(StatusCodes.UNAUTHORIZED);

      await testApp
        .delete(contract.macros.deleteMacro.path.replace(":id", macroId))
        .withoutAuth()
        .expect(StatusCodes.UNAUTHORIZED);
    });
  });
});
