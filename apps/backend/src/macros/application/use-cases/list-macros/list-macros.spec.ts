import { DatabricksAdapter } from "../../../../common/modules/databricks/databricks.adapter";
import { assertSuccess, failure, success } from "../../../../common/utils/fp-utils";
import { resourceMetricsCacheKey } from "../../../../metrics/application/resource-metrics.service";
import { CACHE_PORT } from "../../../../metrics/core/ports/cache.port";
import type { CachePort } from "../../../../metrics/core/ports/cache.port";
import { TestHarness } from "../../../../test/test-harness";
import type { CreateMacroDto } from "../../../core/models/macro.model";
import { MacroRepository } from "../../../core/repositories/macro.repository";
import { ListMacrosUseCase } from "./list-macros";

describe("ListMacrosUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let anotherUserId: string;
  let useCase: ListMacrosUseCase;
  let macroRepository: MacroRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    anotherUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(ListMacrosUseCase);
    macroRepository = testApp.module.get(MacroRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should list all macros without filter", async () => {
    // Arrange
    const macroData1: CreateMacroDto = {
      name: "Python Macro",
      description: "A Python test macro",
      language: "python",
      code: "cHl0aG9uIGNvZGU=",
    };
    const macroData2: CreateMacroDto = {
      name: "R Macro",
      description: "An R test macro",
      language: "r",
      code: "ciBjb2Rl",
    };

    // Create macros
    const createResult1 = await macroRepository.create(macroData1, testUserId);
    const createResult2 = await macroRepository.create(macroData2, anotherUserId);
    assertSuccess(createResult1);
    assertSuccess(createResult2);

    // Act
    const result = await useCase.execute();

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value.length).toBeGreaterThanOrEqual(2);

    const macroNames = result.value.map((macro) => macro.name);
    expect(macroNames).toContain("Python Macro");
    expect(macroNames).toContain("R Macro");
  });

  it("should filter macros by search term", async () => {
    // Arrange
    const macroData1: CreateMacroDto = {
      name: "Data Analysis Script",
      description: "Analyzes experimental data",
      language: "python",
      code: "cHl0aG9uIGNvZGUgZmlsZQ==",
    };
    const macroData2: CreateMacroDto = {
      name: "Image Processing",
      description: "Processes microscopy images",
      language: "python",
      code: "aW1hZ2UgcHJvY2Vzc2luZyBpbWFnZXM=",
    };

    // Create macros
    const createResult1 = await macroRepository.create(macroData1, testUserId);
    const createResult2 = await macroRepository.create(macroData2, testUserId);
    assertSuccess(createResult1);
    assertSuccess(createResult2);

    // Act
    const result = await useCase.execute({ search: "data" });

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);

    // Should find the macro with "data" in name or description
    const foundMacro = result.value.find(
      (macro) =>
        macro.name.toLowerCase().includes("data") ||
        macro.description?.toLowerCase().includes("data"),
    );
    expect(foundMacro).toBeDefined();
  });

  it("should include code file in macro results", async () => {
    // Arrange
    const macroWithCode = {
      name: "Macro With Code",
      description: "A macro with stored code",
      language: "python" as const,
      code: "cHl0aG9uIGNvZGUgZmlsZQ==", // base64 encoded "python code file"
    };

    // Create macro with code
    const createResult = await macroRepository.create(macroWithCode, testUserId);
    assertSuccess(createResult);
    const createdMacroId = createResult.value[0].id;

    // Act
    const result = await useCase.execute();

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);

    const foundMacro = result.value.find((macro) => macro.id === createdMacroId);
    expect(foundMacro).toBeDefined();
    expect(foundMacro?.code).toBe(macroWithCode.code);
  });

  it("should filter macros by language", async () => {
    // Arrange
    const pythonMacro = {
      name: "Python Script",
      description: "A Python macro",
      language: "python" as const,
      code: "cHl0aG9uIGNvZGU=", // base64 encoded "python code"
    };
    const rMacro = {
      name: "R Script",
      description: "An R macro",
      language: "r" as const,
      code: "UiBjb2Rl", // base64 encoded "R code"
    };
    const jsMacro = {
      name: "JavaScript Script",
      description: "A JavaScript macro",
      language: "javascript" as const,
      code: "anMgY29kZQ==", // base64 encoded "js code"
    };

    // Create macros
    await macroRepository.create(pythonMacro, testUserId);
    await macroRepository.create(rMacro, testUserId);
    await macroRepository.create(jsMacro, testUserId);

    // Act - Filter by Python
    const pythonResult = await useCase.execute({ languages: ["python"] });

    // Assert
    expect(pythonResult.isSuccess()).toBe(true);
    assertSuccess(pythonResult);

    const pythonMacros = pythonResult.value.filter((macro) => macro.language === "python");
    expect(pythonMacros.length).toBeGreaterThan(0);

    // All returned macros should be Python
    pythonResult.value.forEach((macro) => {
      expect(macro.language).toBe("python");
    });
  });

  it("should combine search and language filters", async () => {
    // Arrange
    const macroData1: CreateMacroDto = {
      name: "Analysis Python Script",
      description: "Python data analysis",
      language: "python",
      code: "cHl0aG9uIGNvZGU=",
    };
    const macroData2: CreateMacroDto = {
      name: "Analysis R Script",
      description: "R data analysis",
      language: "r",
      code: "ciBjb2Rl",
    };

    // Create macros
    await macroRepository.create(macroData1, testUserId);
    await macroRepository.create(macroData2, testUserId);

    // Act
    const result = await useCase.execute({
      search: "analysis",
      languages: ["python"],
    });

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);

    // Should only find Python macros matching "analysis"
    result.value.forEach((macro) => {
      expect(macro.language).toBe("python");
      expect(
        macro.name.toLowerCase().includes("analysis") ||
          macro.description?.toLowerCase().includes("analysis"),
      ).toBe(true);
    });
  });

  it("should return empty array when no macros match filters", async () => {
    // Act
    const result = await useCase.execute({
      search: "nonexistent-macro-search-term",
      languages: ["python"],
    });

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    expect(result.value).toEqual([]);
  });

  describe("language and visibility filters", () => {
    const ids = (rows: { id: string }[]) => rows.map((row) => row.id);

    it("matches either of two languages and treats an empty list as no filter", async () => {
      const python = await testApp.createMacro({
        name: "Py",
        language: "python",
        createdBy: testUserId,
      });
      const r = await testApp.createMacro({ name: "Rr", language: "r", createdBy: testUserId });
      const js = await testApp.createMacro({
        name: "Js",
        language: "javascript",
        createdBy: testUserId,
      });

      const either = await useCase.execute({ languages: ["r", "javascript"], userId: testUserId });
      assertSuccess(either);
      expect(ids(either.value)).toEqual(expect.arrayContaining([r.id, js.id]));
      expect(ids(either.value)).not.toContain(python.id);

      const unfiltered = await useCase.execute({ languages: [], userId: testUserId });
      assertSuccess(unfiltered);
      expect(ids(unfiltered.value)).toEqual(expect.arrayContaining([python.id, r.id, js.id]));
    });

    it("narrows by visibility inside what the caller can see", async () => {
      const ownPrivate = await testApp.createMacro({
        name: "Own private",
        createdBy: testUserId,
        visibility: "private",
      });
      const ownPublic = await testApp.createMacro({
        name: "Own public",
        createdBy: testUserId,
        visibility: "public",
      });
      const othersPrivate = await testApp.createMacro({
        name: "Others private",
        createdBy: anotherUserId,
        visibility: "private",
      });

      const result = await useCase.execute({ visibilities: ["private"], userId: testUserId });
      assertSuccess(result);
      expect(ids(result.value)).toContain(ownPrivate.id);
      expect(ids(result.value)).not.toContain(ownPublic.id);
      expect(ids(result.value)).not.toContain(othersPrivate.id);
    });

    it("needs both filters to match, also on a page whose count follows the filter", async () => {
      const match = await testApp.createMacro({
        name: "Filter match",
        language: "r",
        createdBy: testUserId,
        visibility: "private",
      });
      await testApp.createMacro({
        name: "Filter public r",
        language: "r",
        createdBy: testUserId,
        visibility: "public",
      });
      await testApp.createMacro({
        name: "Filter private python",
        language: "python",
        createdBy: testUserId,
        visibility: "private",
      });

      const paged = await useCase.executePaginated(1, 10, {
        search: "filter",
        languages: ["r"],
        visibilities: ["private"],
        userId: testUserId,
      });
      assertSuccess(paged);
      expect(ids(paged.value.items)).toEqual([match.id]);
      expect(paged.value.totalCount).toBe(1);
    });
  });

  describe("activity snapshot fallback", () => {
    async function makeWarehouseUnavailable() {
      const adapter = testApp.module.get(DatabricksAdapter);
      vi.spyOn(adapter, "getResourceDailyActivity").mockResolvedValue(
        failure({
          name: "AppError",
          code: "INTERNAL_ERROR",
          message: "warehouse down",
          statusCode: 500,
        }),
      );
      await testApp.module.get<CachePort>(CACHE_PORT).invalidate(resourceMetricsCacheKey("macro"));
    }

    it("falls back to name order and reports unavailable when activity is paired with name and there is no snapshot", async () => {
      await makeWarehouseUnavailable();
      await testApp.createMacro({ name: "Alpha", createdBy: testUserId, visibility: "public" });
      await testApp.createMacro({ name: "Bravo", createdBy: testUserId, visibility: "public" });

      const result = await useCase.executePaginated(1, 20, {
        userId: testUserId,
        sort: [
          { field: "activity", direction: "desc" },
          { field: "name", direction: "asc" },
        ],
      });

      assertSuccess(result);
      expect(result.value.activityAvailable).toBe(false);
      expect(result.value.items.map((item) => item.name)).toEqual(["Alpha", "Bravo"]);
    });

    it("reports unavailable and the default order when sorting only by activity with no snapshot", async () => {
      await makeWarehouseUnavailable();
      // Created out of alphabetical order, so a name-order result proves the
      // real default ordering ran rather than insertion order.
      const charlie = await testApp.createMacro({
        name: "Charlie",
        createdBy: testUserId,
        visibility: "public",
      });
      const alpha = await testApp.createMacro({
        name: "Alpha",
        createdBy: testUserId,
        visibility: "public",
      });
      const bravo = await testApp.createMacro({
        name: "Bravo",
        createdBy: testUserId,
        visibility: "public",
      });

      const result = await useCase.executePaginated(1, 20, {
        userId: testUserId,
        sort: [{ field: "activity", direction: "desc" }],
      });

      assertSuccess(result);
      expect(result.value.activityAvailable).toBe(false);
      expect(result.value.items.map((item) => item.id)).toEqual([alpha.id, bravo.id, charlie.id]);
    });

    it("orders items consistently with the activity measurements it reports", async () => {
      const busy = await testApp.createMacro({
        name: "Busy macro",
        createdBy: testUserId,
        visibility: "public",
      });
      const quiet = await testApp.createMacro({
        name: "Quiet macro",
        createdBy: testUserId,
        visibility: "public",
      });

      const adapter = testApp.module.get(DatabricksAdapter);
      const today = new Date().toISOString().slice(0, 10);
      vi.spyOn(adapter, "getResourceDailyActivity").mockResolvedValue(
        success([
          { date: today, resourceType: "macro", resourceId: busy.id, measurements: 9 },
          { date: today, resourceType: "macro", resourceId: quiet.id, measurements: 1 },
        ]),
      );
      await testApp.module.get<CachePort>(CACHE_PORT).invalidate(resourceMetricsCacheKey("macro"));

      const result = await useCase.executePaginated(1, 20, {
        userId: testUserId,
        sort: [{ field: "activity", direction: "desc" }],
      });

      assertSuccess(result);
      expect(result.value.activityAvailable).toBe(true);
      const foundIds = result.value.items.map((item) => item.id);
      expect(foundIds.indexOf(busy.id)).toBeLessThan(foundIds.indexOf(quiet.id));
      expect(result.value.items.find((item) => item.id === busy.id)?.activity?.measurements).toBe(
        9,
      );
      expect(result.value.items.find((item) => item.id === quiet.id)?.activity?.measurements).toBe(
        1,
      );
    });

    it("array path (execute): sorts by activity when a snapshot is available", async () => {
      // Named so default (name) order would put quiet first; only activity
      // sort can put busy first, proving activity actually drove the order.
      const busy = await testApp.createMacro({
        name: "Zulu macro",
        createdBy: testUserId,
        visibility: "public",
      });
      const quiet = await testApp.createMacro({
        name: "Alpha macro",
        createdBy: testUserId,
        visibility: "public",
      });

      const adapter = testApp.module.get(DatabricksAdapter);
      const today = new Date().toISOString().slice(0, 10);
      vi.spyOn(adapter, "getResourceDailyActivity").mockResolvedValue(
        success([
          { date: today, resourceType: "macro", resourceId: busy.id, measurements: 9 },
          { date: today, resourceType: "macro", resourceId: quiet.id, measurements: 1 },
        ]),
      );
      await testApp.module.get<CachePort>(CACHE_PORT).invalidate(resourceMetricsCacheKey("macro"));

      const result = await useCase.execute({
        userId: testUserId,
        sort: [{ field: "activity", direction: "desc" }],
      });

      assertSuccess(result);
      const ids = result.value.map((item) => item.id);
      expect(ids.indexOf(busy.id)).toBeLessThan(ids.indexOf(quiet.id));
    });

    it("array path (execute): drops the activity criterion silently when there is no snapshot", async () => {
      await makeWarehouseUnavailable();
      // Created out of alphabetical order, so a name-order result proves the
      // real default ordering ran rather than insertion order.
      const charlie = await testApp.createMacro({
        name: "Charlie",
        createdBy: testUserId,
        visibility: "public",
      });
      const alpha = await testApp.createMacro({
        name: "Alpha",
        createdBy: testUserId,
        visibility: "public",
      });

      const result = await useCase.execute({
        userId: testUserId,
        sort: [{ field: "activity", direction: "desc" }],
      });

      assertSuccess(result);
      expect(result.value.map((item) => item.id)).toEqual([alpha.id, charlie.id]);
    });
  });
});
