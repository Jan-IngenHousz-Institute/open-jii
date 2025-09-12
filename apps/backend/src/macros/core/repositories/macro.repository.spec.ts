import { faker } from "@faker-js/faker";

import { macros as macrosTable, eq } from "@repo/database";

import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { MacroRepository } from "./macro.repository";
import type { MacroFilter } from "./macro.repository";

describe("MacroRepository", () => {
  const testApp = TestHarness.App;
  let repository: MacroRepository;
  let testUserId: string;
  let anotherUserId: string;
  const testUserName = "Test User";
  const anotherUserName = "Another User";

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({ name: testUserName });
    anotherUserId = await testApp.createTestUser({ name: anotherUserName });
    repository = testApp.module.get(MacroRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  describe("create", () => {
    it("should create a new macro", async () => {
      // Arrange
      const createMacroDto = {
        name: "Test Macro",
        description: "Test Description",
        language: "python" as const,
        codeFile: "cHl0aG9uIGNvZGU=", // base64 encoded "python code"
      };

      // Act
      const result = await repository.create(createMacroDto, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const macros = result.value;
      const macro = macros[0];

      expect(macro).toMatchObject({
        id: expect.any(String) as string,
        name: createMacroDto.name,
        description: createMacroDto.description,
        language: createMacroDto.language,
        codeFile: createMacroDto.codeFile,
        createdBy: testUserId,
        createdAt: expect.any(Date) as Date,
        updatedAt: expect.any(Date) as Date,
      });

      // Verify directly in database
      const dbResult = await testApp.database
        .select()
        .from(macrosTable)
        .where(eq(macrosTable.id, macro.id));

      expect(dbResult.length).toBe(1);
      expect(dbResult[0]).toMatchObject({
        name: createMacroDto.name,
        description: createMacroDto.description,
        language: createMacroDto.language,
        codeFile: createMacroDto.codeFile,
        createdBy: testUserId,
      });
    });

    it("should create a macro with null description", async () => {
      // Arrange
      const createMacroDto = {
        name: "Macro Without Description",
        description: null,
        language: "r" as const,
      };

      // Act
      const result = await repository.create(createMacroDto, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const macro = result.value[0];

      expect(macro.description).toBeNull();
      expect(macro.name).toBe(createMacroDto.name);
      expect(macro.language).toBe(createMacroDto.language);
    });

    it("should fail to create macro with duplicate name", async () => {
      // Arrange
      const createMacroDto = {
        name: "Unique Macro Name",
        description: "First macro",
        language: "javascript" as const,
      };

      await repository.create(createMacroDto, testUserId);

      const duplicateDto = {
        name: "Unique Macro Name", // Same name
        description: "Second macro",
        language: "python" as const,
      };

      // Act
      const result = await repository.create(duplicateDto, anotherUserId);

      // Assert
      expect(result.isFailure()).toBe(true);
    });
  });

  describe("findAll", () => {
    it("should return all macros without filter", async () => {
      // Arrange
      const macro1 = {
        name: "Python Macro",
        description: "Python Description",
        language: "python" as const,
      };
      const macro2 = {
        name: "R Macro",
        description: "R Description",
        language: "r" as const,
      };

      await repository.create(macro1, testUserId);
      await repository.create(macro2, anotherUserId);

      // Act
      const result = await repository.findAll();

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const macros = result.value;

      expect(macros.length).toBeGreaterThanOrEqual(2);
      expect(macros.some((m) => m.name === macro1.name)).toBe(true);
      expect(macros.some((m) => m.name === macro2.name)).toBe(true);

      // Verify creator names are included
      const pythonMacro = macros.find((m) => m.name === macro1.name);
      expect(pythonMacro?.createdByName).toBe(testUserName);

      const rMacro = macros.find((m) => m.name === macro2.name);
      expect(rMacro?.createdByName).toBe(anotherUserName);
    });

    it("should return macros in correct order (most recently updated first)", async () => {
      // Arrange - create three macros
      const createResult1 = await repository.create(
        {
          name: "First Macro",
          description: "First",
          language: "python" as const,
        },
        testUserId,
      );
      assertSuccess(createResult1);
      const macro1 = createResult1.value[0];

      const createResult2 = await repository.create(
        {
          name: "Second Macro",
          description: "Second",
          language: "r" as const,
        },
        testUserId,
      );
      assertSuccess(createResult2);
      const macro2 = createResult2.value[0];

      const createResult3 = await repository.create(
        {
          name: "Third Macro",
          description: "Third",
          language: "javascript" as const,
        },
        testUserId,
      );
      assertSuccess(createResult3);
      const macro3 = createResult3.value[0];

      // Update the first macro to make it most recent
      await repository.update(macro1.id, { description: "Updated First" });

      // Act
      const result = await repository.findAll();

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const macros = result.value;

      const macroIds = macros.map((m) => m.id);
      const firstMacroIndex = macroIds.indexOf(macro1.id);
      const secondMacroIndex = macroIds.indexOf(macro2.id);
      const thirdMacroIndex = macroIds.indexOf(macro3.id);

      // First macro should be first (most recently updated)
      expect(firstMacroIndex).toBe(0);
      // Third macro should be second (second most recent)
      expect(thirdMacroIndex).toBe(1);
      // Second macro should be third (oldest)
      expect(secondMacroIndex).toBe(2);
    });

    it("should filter macros by search term", async () => {
      // Arrange
      await repository.create(
        {
          name: "Data Analysis Macro",
          description: "For data processing",
          language: "python" as const,
        },
        testUserId,
      );

      await repository.create(
        {
          name: "Visualization Script",
          description: "For creating charts",
          language: "r" as const,
        },
        testUserId,
      );

      const filter: MacroFilter = { search: "data" };

      // Act
      const result = await repository.findAll(filter);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const macros = result.value;

      expect(macros.length).toBe(1);
      expect(macros[0].name).toBe("Data Analysis Macro");
    });

    it("should filter macros by language", async () => {
      // Arrange
      await repository.create(
        {
          name: "Python Script",
          description: "Python macro",
          language: "python" as const,
        },
        testUserId,
      );

      await repository.create(
        {
          name: "R Script",
          description: "R macro",
          language: "r" as const,
        },
        testUserId,
      );

      await repository.create(
        {
          name: "JavaScript Function",
          description: "JS macro",
          language: "javascript" as const,
        },
        testUserId,
      );

      const filter: MacroFilter = { language: "python" };

      // Act
      const result = await repository.findAll(filter);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const macros = result.value;

      expect(macros.length).toBe(1);
      expect(macros[0].name).toBe("Python Script");
      expect(macros[0].language).toBe("python");
    });

    it("should filter macros by both search term and language", async () => {
      // Arrange
      await repository.create(
        {
          name: "Data Analysis Python",
          description: "Python data processing",
          language: "python" as const,
        },
        testUserId,
      );

      await repository.create(
        {
          name: "Data Analysis R",
          description: "R data processing",
          language: "r" as const,
        },
        testUserId,
      );

      await repository.create(
        {
          name: "Visualization Python",
          description: "Python visualization",
          language: "python" as const,
        },
        testUserId,
      );

      const filter: MacroFilter = { search: "data", language: "python" };

      // Act
      const result = await repository.findAll(filter);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const macros = result.value;

      expect(macros.length).toBe(1);
      expect(macros[0].name).toBe("Data Analysis Python");
    });

    it("should return empty array when no macros match filter", async () => {
      // Arrange
      await repository.create(
        {
          name: "Python Script",
          description: "A Python macro",
          language: "python" as const,
        },
        testUserId,
      );

      const filter: MacroFilter = { search: "nonexistent" };

      // Act
      const result = await repository.findAll(filter);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(0);
    });

    it("should handle case-insensitive search", async () => {
      // Arrange
      await repository.create(
        {
          name: "Machine Learning Model",
          description: "ML processing script",
          language: "python" as const,
        },
        testUserId,
      );

      const filter: MacroFilter = { search: "MACHINE" };

      // Act
      const result = await repository.findAll(filter);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const macros = result.value;

      expect(macros.length).toBe(1);
      expect(macros[0].name).toBe("Machine Learning Model");
    });
  });

  describe("findById", () => {
    it("should return macro by id with creator name", async () => {
      // Arrange
      const createMacroDto = {
        name: "Test Macro",
        description: "Test Description",
        language: "python" as const,
      };

      const createResult = await repository.create(createMacroDto, testUserId);
      assertSuccess(createResult);
      const createdMacro = createResult.value[0];

      // Act
      const result = await repository.findById(createdMacro.id);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const macro = result.value;

      expect(macro).not.toBeNull();
      expect(macro).toMatchObject({
        id: createdMacro.id,
        name: createMacroDto.name,
        description: createMacroDto.description,
        language: createMacroDto.language,
        createdBy: testUserId,
        createdByName: testUserName,
      });
    });

    it("should return null for non-existent macro", async () => {
      // Arrange
      const nonExistentId = faker.string.uuid();

      // Act
      const result = await repository.findById(nonExistentId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toBeNull();
    });

    it("should handle invalid UUID format", async () => {
      // Arrange
      const invalidId = "invalid-uuid";

      // Act
      const result = await repository.findById(invalidId);

      // Assert
      expect(result.isFailure()).toBe(true);
    });
  });

  describe("update", () => {
    it("should update macro with all fields", async () => {
      // Arrange
      const createMacroDto = {
        name: "Original Macro",
        description: "Original Description",
        language: "python" as const,
        codeFile: "b3JpZ2luYWwgY29kZQ==", // base64 encoded "original code"
      };

      const createResult = await repository.create(createMacroDto, testUserId);
      assertSuccess(createResult);
      const createdMacro = createResult.value[0];
      const originalUpdatedAt = createdMacro.updatedAt;

      const updateDto = {
        name: "Updated Macro",
        description: "Updated Description",
        language: "javascript" as const,
        codeFile: "dXBkYXRlZCBjb2Rl", // base64 encoded "updated code"
      };

      // Act
      const result = await repository.update(createdMacro.id, updateDto);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const updatedMacros = result.value;
      const updatedMacro = updatedMacros[0];

      expect(updatedMacro).toMatchObject({
        id: createdMacro.id,
        name: updateDto.name,
        description: updateDto.description,
        language: updateDto.language,
        codeFile: updateDto.codeFile,
        createdBy: testUserId,
      });

      // Verify updatedAt timestamp changed
      expect(new Date(updatedMacro.updatedAt).getTime()).toBeGreaterThan(
        new Date(originalUpdatedAt).getTime(),
      );

      // Verify in database
      const dbResult = await testApp.database
        .select()
        .from(macrosTable)
        .where(eq(macrosTable.id, createdMacro.id));

      expect(dbResult[0]).toMatchObject(updateDto);
    });

    it("should update macro with partial fields", async () => {
      // Arrange
      const createMacroDto = {
        name: "Original Macro",
        description: "Original Description",
        language: "python" as const,
        codeFile: "b3JpZ2luYWwgY29kZQ==", // base64 encoded "original code"
      };

      const createResult = await repository.create(createMacroDto, testUserId);
      assertSuccess(createResult);
      const createdMacro = createResult.value[0];

      const partialUpdate = {
        name: "Partially Updated Macro",
      };

      // Act
      const result = await repository.update(createdMacro.id, partialUpdate);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const updatedMacro = result.value[0];

      expect(updatedMacro).toMatchObject({
        id: createdMacro.id,
        name: partialUpdate.name,
        description: createMacroDto.description,
        language: createMacroDto.language,
        codeFile: createMacroDto.codeFile,
        createdBy: testUserId,
      });
    });

    it("should return empty array when updating non-existent macro", async () => {
      // Arrange
      const nonExistentId = faker.string.uuid();
      const updateDto = {
        name: "Updated Name",
      };

      // Act
      const result = await repository.update(nonExistentId, updateDto);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(0);
    });

    it("should handle invalid UUID format", async () => {
      // Arrange
      const invalidId = "invalid-uuid";
      const updateDto = {
        name: "Updated Name",
      };

      // Act
      const result = await repository.update(invalidId, updateDto);

      // Assert
      expect(result.isFailure()).toBe(true);
    });

    it("should fail to update with duplicate name", async () => {
      // Arrange - create two macros
      const firstMacro = await repository.create(
        {
          name: "First Macro",
          description: "First",
          language: "python" as const,
        },
        testUserId,
      );
      assertSuccess(firstMacro);

      const secondMacro = await repository.create(
        {
          name: "Second Macro",
          description: "Second",
          language: "r" as const,
        },
        testUserId,
      );
      assertSuccess(secondMacro);

      // Try to update second macro with first macro's name
      const updateDto = {
        name: "First Macro", // Duplicate name
      };

      // Act
      const result = await repository.update(secondMacro.value[0].id, updateDto);

      // Assert
      expect(result.isFailure()).toBe(true);
    });
  });

  describe("delete", () => {
    it("should delete macro by id", async () => {
      // Arrange
      const createMacroDto = {
        name: "Macro to Delete",
        description: "This will be deleted",
        language: "python" as const,
      };

      const createResult = await repository.create(createMacroDto, testUserId);
      assertSuccess(createResult);
      const createdMacro = createResult.value[0];

      // Act
      const result = await repository.delete(createdMacro.id);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const deletedMacros = result.value;
      expect(deletedMacros).toHaveLength(1);
      expect(deletedMacros[0].id).toBe(createdMacro.id);

      // Verify macro is deleted from database
      const dbResult = await testApp.database
        .select()
        .from(macrosTable)
        .where(eq(macrosTable.id, createdMacro.id));

      expect(dbResult).toHaveLength(0);
    });

    it("should return empty array when deleting non-existent macro", async () => {
      // Arrange
      const nonExistentId = faker.string.uuid();

      // Act
      const result = await repository.delete(nonExistentId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      expect(result.value).toHaveLength(0);
    });

    it("should handle invalid UUID format", async () => {
      // Arrange
      const invalidId = "invalid-uuid";

      // Act
      const result = await repository.delete(invalidId);

      // Assert
      expect(result.isFailure()).toBe(true);
    });
  });
});
