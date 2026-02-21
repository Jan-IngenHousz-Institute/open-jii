import { faker } from "@faker-js/faker";

import { macros as macrosTable, eq } from "@repo/database";

import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import type { CreateMacroDto } from "../models/macro.model";
import { generateHashedFilename } from "../models/macro.model";
import type { CachePort } from "../ports/cache.port";
import { CACHE_PORT } from "../ports/cache.port";
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
        code: "cHl0aG9uIGNvZGU=", // base64 encoded "python code"
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
        filename: generateHashedFilename(macro.id),
        description: createMacroDto.description,
        language: createMacroDto.language,
        code: createMacroDto.code,
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
        filename: generateHashedFilename(macro.id),
        description: createMacroDto.description,
        language: createMacroDto.language,
        code: createMacroDto.code,
        createdBy: testUserId,
      });
    });

    it("should create a macro with null description", async () => {
      // Arrange
      const createMacroDto = {
        name: "Macro Without Description",
        description: null,
        language: "r" as const,
        code: "UiBjb2RlIGhlcmU=", // base64 encoded "R code here"
      };

      // Act
      const result = await repository.create(createMacroDto, testUserId);

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const macro = result.value[0];

      expect(macro.description).toBeNull();
      expect(macro.name).toBe(createMacroDto.name);
      expect(macro.filename).toBe(generateHashedFilename(macro.id));
      expect(macro.language).toBe(createMacroDto.language);
    });

    it("should fail to create macro with duplicate name", async () => {
      // Arrange
      const createMacroDto: CreateMacroDto = {
        name: "Unique Macro Name",
        description: "First macro",
        language: "javascript",
        code: "amF2YXNjcmlwdCBjb2Rl", // base64 encoded "javascript code"
      };

      await repository.create(createMacroDto, testUserId);

      const duplicateDto: CreateMacroDto = {
        name: "Unique Macro Name", // Same name
        description: "Second macro",
        language: "python",
        code: "cHl0aG9uIGNvZGU=", // base64 encoded "python code"
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
      const macro1: CreateMacroDto = {
        name: "Python Macro",
        description: "Python Description",
        language: "python",
        code: "cHl0aG9uIGNvZGU=", // base64 encoded "python code"
      };
      const macro2: CreateMacroDto = {
        name: "R Macro",
        description: "R Description",
        language: "r",
        code: "UiBjb2Rl", // base64 encoded "R code"
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

    it("should return macros ordered by sortOrder first, then alphabetically", async () => {
      // Arrange - create macros with different sortOrder values and names
      const createResult1 = await repository.create(
        {
          name: "Zebra Macro",
          description: "No sort order",
          language: "python",
          code: "Zmlyc3QgbWFjcm8=",
        },
        testUserId,
      );
      assertSuccess(createResult1);

      const createResult2 = await repository.create(
        {
          name: "Alpha Macro",
          description: "No sort order",
          language: "r",
          code: "YWxwaGEgbWFjcm8=",
        },
        testUserId,
      );
      assertSuccess(createResult2);

      const createResult3 = await repository.create(
        {
          name: "Featured Macro 2",
          description: "Sort order 2",
          language: "javascript",
          code: "ZmVhdHVyZWQgbWFjcm8gMg==",
        },
        testUserId,
      );
      assertSuccess(createResult3);
      const macroFeatured2 = createResult3.value[0];

      const createResult4 = await repository.create(
        {
          name: "Featured Macro 1",
          description: "Sort order 1",
          language: "python",
          code: "ZmVhdHVyZWQgbWFjcm8gMQ==",
        },
        testUserId,
      );
      assertSuccess(createResult4);
      const macroFeatured1 = createResult4.value[0];

      // Set sortOrder values
      await repository.update(macroFeatured1.id, { sortOrder: 1 });
      await repository.update(macroFeatured2.id, { sortOrder: 2 });

      // Act
      const result = await repository.findAll();

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const macros = result.value;

      const macroNames = macros.map((m) => m.name);

      // Featured macros should come first, ordered by sortOrder (1, then 2)
      expect(macroNames[0]).toBe("Featured Macro 1");
      expect(macroNames[1]).toBe("Featured Macro 2");

      // Then alphabetically: Alpha, then Zebra
      const alphaIndex = macroNames.indexOf("Alpha Macro");
      const zebraIndex = macroNames.indexOf("Zebra Macro");
      expect(alphaIndex).toBeGreaterThan(1); // After featured macros
      expect(zebraIndex).toBeGreaterThan(alphaIndex); // Zebra after Alpha
    });

    it("should handle all macros with sortOrder correctly", async () => {
      // Arrange - create macros all with sortOrder
      const createResult1 = await repository.create(
        {
          name: "Third Priority",
          description: "Sort order 30",
          language: "python",
          code: "dGhpcmQgcHJpb3JpdHk=",
        },
        testUserId,
      );
      assertSuccess(createResult1);
      const macro3 = createResult1.value[0];

      const createResult2 = await repository.create(
        {
          name: "First Priority",
          description: "Sort order 10",
          language: "r",
          code: "Zmlyc3QgcHJpb3JpdHk=",
        },
        testUserId,
      );
      assertSuccess(createResult2);
      const macro1 = createResult2.value[0];

      const createResult3 = await repository.create(
        {
          name: "Second Priority",
          description: "Sort order 20",
          language: "javascript",
          code: "c2Vjb25kIHByaW9yaXR5",
        },
        testUserId,
      );
      assertSuccess(createResult3);
      const macro2 = createResult3.value[0];

      // Set sortOrder values
      await repository.update(macro1.id, { sortOrder: 10 });
      await repository.update(macro2.id, { sortOrder: 20 });
      await repository.update(macro3.id, { sortOrder: 30 });

      // Act
      const result = await repository.findAll();

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const macros = result.value;

      const macroNames = macros.map((m) => m.name);

      // Should be ordered by sortOrder value: 10, 20, 30
      expect(macroNames[0]).toBe("First Priority");
      expect(macroNames[1]).toBe("Second Priority");
      expect(macroNames[2]).toBe("Third Priority");
    });

    it("should handle all macros without sortOrder alphabetically", async () => {
      // Arrange - create macros all without sortOrder
      await repository.create(
        {
          name: "Charlie",
          description: "No sort order",
          language: "python",
          code: "Y2hhcmxpZQ==",
        },
        testUserId,
      );

      await repository.create(
        {
          name: "Alpha",
          description: "No sort order",
          language: "r",
          code: "YWxwaGE=",
        },
        testUserId,
      );

      await repository.create(
        {
          name: "Bravo",
          description: "No sort order",
          language: "javascript",
          code: "YnJhdm8=",
        },
        testUserId,
      );

      // Act
      const result = await repository.findAll();

      // Assert
      expect(result.isSuccess()).toBe(true);
      assertSuccess(result);
      const macros = result.value;

      const macroNames = macros.map((m) => m.name);

      // Should be ordered alphabetically: Alpha, Bravo, Charlie
      expect(macroNames[0]).toBe("Alpha");
      expect(macroNames[1]).toBe("Bravo");
      expect(macroNames[2]).toBe("Charlie");
    });

    it("should filter macros by search term", async () => {
      // Arrange
      await repository.create(
        {
          name: "Data Analysis Macro",
          description: "For data processing",
          language: "python",
          code: "ZGF0YSBhbmFseXNpcw==", // base64 encoded "data analysis"
        },
        testUserId,
      );

      await repository.create(
        {
          name: "Visualization Script",
          description: "For creating charts",
          language: "r",
          code: "dmlzdWFsaXphdGlvbg==", // base64 encoded "visualization"
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
          language: "python",
          code: "cHl0aG9uIHNjcmlwdA==", // base64 encoded "python script"
        },
        testUserId,
      );

      await repository.create(
        {
          name: "R Script",
          description: "R macro",
          language: "r",
          code: "UiBzY3JpcHQ=", // base64 encoded "R script"
        },
        testUserId,
      );

      await repository.create(
        {
          name: "JavaScript Function",
          description: "JS macro",
          language: "javascript",
          code: "amF2YXNjcmlwdCBmdW5jdGlvbg==", // base64 encoded "javascript function"
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
          language: "python",
          code: "ZGF0YSBhbmFseXNpcyBweXRob24=", // base64 encoded "data analysis python"
        },
        testUserId,
      );

      await repository.create(
        {
          name: "Data Analysis R",
          description: "R data processing",
          language: "r",
          code: "ZGF0YSBhbmFseXNpcyBSIGNvZGU=", // base64 encoded "data analysis R code"
        },
        testUserId,
      );

      await repository.create(
        {
          name: "Visualization Python",
          description: "Python visualization",
          language: "python",
          code: "cHl0aG9uIHZpc3VhbGl6YXRpb24=", // base64 encoded "python visualization"
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
          language: "python",
          code: "cHl0aG9uIHNjcmlwdA==", // base64 encoded "python script"
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
          language: "python",
          code: "bWFjaGluZSBsZWFybmluZyBtb2RlbA==", // base64 encoded "machine learning model"
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
      const createMacroDto: CreateMacroDto = {
        name: "Test Macro",
        description: "Test Description",
        language: "python",
        code: "dGVzdCBtYWNybw==", // base64 encoded "test macro"
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

  describe("anonymization", () => {
    it("should return real names for activated profiles", async () => {
      const activeUserId = await testApp.createTestUser({ name: "Active User", activated: true });

      await repository.create(
        {
          name: "Active Macro",
          description: "From active user",
          language: "python",
          code: "YWN0aXZlIGNvZGU=",
        },
        activeUserId,
      );

      const result = await repository.findAll();
      assertSuccess(result);
      const macro = result.value.find((m) => m.name === "Active Macro");

      expect(macro?.createdByName).toBe("Active User");
    });

    it("should anonymize names for deactivated profiles", async () => {
      const inactiveUserId = await testApp.createTestUser({
        name: "Hidden User",
        activated: false,
      });

      await repository.create(
        {
          name: "Hidden Macro",
          description: "From inactive user",
          language: "r",
          code: "aGlkZGVuIGNvZGU=",
        },
        inactiveUserId,
      );

      const result = await repository.findAll();
      assertSuccess(result);
      const macro = result.value.find((m) => m.name === "Hidden Macro");

      expect(macro?.createdByName).toBe("Unknown User");
    });

    it("should anonymize names in findById as well", async () => {
      const inactiveUserId = await testApp.createTestUser({ name: "Ghost User", activated: false });

      const createResult = await repository.create(
        {
          name: "Ghost Macro",
          description: "Invisible macro",
          language: "python",
          code: "Z2hvc3QgbWFjcm8=",
        },
        inactiveUserId,
      );
      assertSuccess(createResult);
      const createdMacro = createResult.value[0];

      const result = await repository.findById(createdMacro.id);
      assertSuccess(result);

      expect(result.value?.createdByName).toBe("Unknown User");
    });
  });

  describe("update", () => {
    it("should update macro with all fields", async () => {
      // Arrange
      const createMacroDto = {
        name: "Original Macro",
        description: "Original Description",
        language: "python" as const,
        code: "b3JpZ2luYWwgY29kZQ==", // base64 encoded "original code"
      };

      const createResult = await repository.create(createMacroDto, testUserId);
      assertSuccess(createResult);
      const createdMacro = createResult.value[0];

      const updateDto = {
        name: "Updated Macro",
        description: "Updated Description",
        language: "javascript" as const,
        code: "dXBkYXRlZCBjb2Rl", // base64 encoded "updated code"
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
        filename: createdMacro.filename, // Filename should remain the same
        description: updateDto.description,
        language: updateDto.language,
        code: updateDto.code,
        createdBy: testUserId,
      });

      // Verify in database
      const dbResult = await testApp.database
        .select()
        .from(macrosTable)
        .where(eq(macrosTable.id, createdMacro.id));

      expect(dbResult[0]).toMatchObject({
        ...updateDto,
        filename: createdMacro.filename, // Filename should remain the same
      });
    });

    it("should update macro with partial fields", async () => {
      // Arrange
      const createMacroDto = {
        name: "Original Macro",
        description: "Original Description",
        language: "python" as const,
        code: "b3JpZ2luYWwgY29kZQ==", // base64 encoded "original code"
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
        filename: createdMacro.filename, // Filename should remain the same
        description: createMacroDto.description,
        language: createMacroDto.language,
        code: createMacroDto.code,
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
          language: "python",
          code: "Zmlyc3QgbWFjcm8=", // base64 encoded "first macro"
        },
        testUserId,
      );
      assertSuccess(firstMacro);

      const secondMacro = await repository.create(
        {
          name: "Second Macro",
          description: "Second",
          language: "r",
          code: "c2Vjb25kIG1hY3Jv", // base64 encoded "second macro"
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

    it("should keep filename unchanged when updating macro name", async () => {
      // Arrange
      const createMacroDto = {
        name: "Original Macro Name",
        description: "Test filename consistency",
        language: "python" as const,
        code: "dGVzdCBjb2Rl", // base64 encoded "test code"
      };

      const createResult = await repository.create(createMacroDto, testUserId);
      assertSuccess(createResult);
      const createdMacro = createResult.value[0];
      const originalFilename = createdMacro.filename;

      // Test updating with a completely different name
      const updateDto = {
        name: "COMPLETELY DIFFERENT NEW NAME",
      };

      const updateResult = await repository.update(createdMacro.id, updateDto);
      assertSuccess(updateResult);
      const updatedMacro = updateResult.value[0];

      // Assert the filename remained unchanged
      expect(updatedMacro.filename).toBe(originalFilename);
      expect(updatedMacro.name).toBe(updateDto.name);
      // Verify filename is still based on the original ID
      expect(updatedMacro.filename).toBe(generateHashedFilename(createdMacro.id));
    });
  });

  describe("delete", () => {
    it("should delete macro by id", async () => {
      // Arrange
      const createMacroDto: CreateMacroDto = {
        name: "Macro to Delete",
        description: "This will be deleted",
        language: "python",
        code: "bWFjcm8gdG8gZGVsZXRl", // base64 encoded "macro to delete"
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

  describe("findScriptById", () => {
    it("should return a lean MacroScript for an existing macro", async () => {
      const createResult = await repository.create(
        {
          name: "Script Macro",
          description: "Script test",
          language: "python",
          code: "cHJpbnQoJ2hlbGxvJyk=", // base64
        },
        testUserId,
      );
      assertSuccess(createResult);
      const created = createResult.value[0];

      const result = await repository.findScriptById(created.id);

      assertSuccess(result);
      expect(result.value).not.toBeNull();
      expect(result.value).toMatchObject({
        id: created.id,
        name: "Script Macro",
        language: "python",
        code: "cHJpbnQoJ2hlbGxvJyk=",
      });
      // Should NOT have full MacroDto fields
      expect(result.value).not.toHaveProperty("createdByName");
      expect(result.value).not.toHaveProperty("filename");
      expect(result.value).not.toHaveProperty("description");
    });

    it("should return null for a non-existent macro", async () => {
      const result = await repository.findScriptById(faker.string.uuid());

      assertSuccess(result);
      expect(result.value).toBeNull();
    });

    it("should return cached value on second call", async () => {
      const createResult = await repository.create(
        {
          name: "Cached Script",
          description: "Caching test",
          language: "javascript",
          code: "Y29uc29sZS5sb2coJ2hpJyk=",
        },
        testUserId,
      );
      assertSuccess(createResult);
      const created = createResult.value[0];

      const cachePort = testApp.module.get<CachePort>(CACHE_PORT);
      const tryCacheSpy = vi.spyOn(cachePort, "tryCache");

      // First call fills cache
      await repository.findScriptById(created.id);
      // Second call should still invoke tryCache (which returns from cache)
      await repository.findScriptById(created.id);

      expect(tryCacheSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe("findScriptsByIds", () => {
    it("should return a map of MacroScript for existing macros", async () => {
      const r1 = await repository.create(
        { name: "Batch A", description: "A", language: "python", code: "Y29kZTE=" },
        testUserId,
      );
      assertSuccess(r1);
      const r2 = await repository.create(
        { name: "Batch B", description: "B", language: "r", code: "Y29kZTI=" },
        testUserId,
      );
      assertSuccess(r2);

      const ids = [r1.value[0].id, r2.value[0].id];
      const result = await repository.findScriptsByIds(ids);

      assertSuccess(result);
      const map = result.value;
      expect(map.size).toBe(2);
      expect(map.get(ids[0])).toMatchObject({ name: "Batch A", language: "python" });
      expect(map.get(ids[1])).toMatchObject({ name: "Batch B", language: "r" });
    });

    it("should return an empty map for non-existent IDs", async () => {
      const result = await repository.findScriptsByIds([faker.string.uuid()]);

      assertSuccess(result);
      expect(result.value.size).toBe(0);
    });
  });

  describe("invalidateCache", () => {
    it("should call through to the cache port", async () => {
      const cachePort = testApp.module.get<CachePort>(CACHE_PORT);
      const invalidateSpy = vi.spyOn(cachePort, "invalidate");

      const id = faker.string.uuid();
      await repository.invalidateCache(id);

      expect(invalidateSpy).toHaveBeenCalledWith(id);
    });
  });
});
