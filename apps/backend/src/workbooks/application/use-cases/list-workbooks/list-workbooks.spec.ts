import { experiments, inArray, workbookVersions } from "@repo/database";

import { DatabricksAdapter } from "../../../../common/modules/databricks/databricks.adapter";
import { assertSuccess, failure, success } from "../../../../common/utils/fp-utils";
import { resourceMetricsCacheKey } from "../../../../metrics/application/resource-metrics.service";
import { CACHE_PORT } from "../../../../metrics/core/ports/cache.port";
import type { CachePort } from "../../../../metrics/core/ports/cache.port";
import { TestHarness } from "../../../../test/test-harness";
import { ListWorkbooksUseCase } from "./list-workbooks";

describe("ListWorkbooksUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: ListWorkbooksUseCase;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({});
    useCase = testApp.module.get(ListWorkbooksUseCase);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("returns empty list when no workbooks exist", async () => {
    const result = await useCase.execute();
    assertSuccess(result);
    expect(result.value).toEqual([]);
  });

  it("returns all workbooks", async () => {
    await testApp.createWorkbook({ name: "WB 1", createdBy: userId });
    await testApp.createWorkbook({ name: "WB 2", createdBy: userId });
    const result = await useCase.execute();
    assertSuccess(result);
    expect(result.value).toHaveLength(2);
  });

  it("filters by search term", async () => {
    await testApp.createWorkbook({ name: "Alpha Workbook", createdBy: userId });
    await testApp.createWorkbook({ name: "Beta Workbook", createdBy: userId });
    const result = await useCase.execute({ search: "Alpha" });
    assertSuccess(result);
    expect(result.value).toHaveLength(1);
    expect(result.value[0].name).toBe("Alpha Workbook");
  });

  it("scopes to related to show only the caller's workbooks", async () => {
    const otherUser = await testApp.createTestUser({});
    await testApp.createWorkbook({ name: "Mine", createdBy: userId });
    await testApp.createWorkbook({ name: "Theirs", createdBy: otherUser });
    const result = await useCase.execute({ scope: "related", userId });
    assertSuccess(result);
    expect(result.value).toHaveLength(1);
    expect(result.value[0].name).toBe("Mine");
  });

  it("returns workbooks sorted by name", async () => {
    await testApp.createWorkbook({ name: "Charlie", createdBy: userId });
    await testApp.createWorkbook({ name: "Alpha", createdBy: userId });
    await testApp.createWorkbook({ name: "Bravo", createdBy: userId });
    const result = await useCase.execute();
    assertSuccess(result);
    expect(result.value.map((w) => w.name)).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  it("includes the count of experiments using each workbook", async () => {
    const used = await testApp.createWorkbook({ name: "Used", createdBy: userId });
    const unused = await testApp.createWorkbook({ name: "Unused", createdBy: userId });

    const { experiment: e1 } = await testApp.createExperiment({ name: "E1", userId });
    const { experiment: e2 } = await testApp.createExperiment({ name: "E2", userId });
    await testApp.database
      .update(experiments)
      .set({ workbookId: used.id })
      .where(inArray(experiments.id, [e1.id, e2.id]));

    const result = await useCase.execute();
    assertSuccess(result);
    expect(result.value.find((w) => w.id === used.id)?.experimentCount).toBe(2);
    expect(result.value.find((w) => w.id === unused.id)?.experimentCount).toBe(0);
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
      await testApp.module
        .get<CachePort>(CACHE_PORT)
        .invalidate(resourceMetricsCacheKey("workbook"));
    }

    it("falls back to name order and reports unavailable when activity is paired with name and there is no snapshot", async () => {
      await makeWarehouseUnavailable();
      await testApp.createWorkbook({ name: "Alpha", createdBy: userId, visibility: "public" });
      await testApp.createWorkbook({ name: "Bravo", createdBy: userId, visibility: "public" });

      const result = await useCase.executePaginated(1, 20, {
        userId,
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
      const charlie = await testApp.createWorkbook({
        name: "Charlie",
        createdBy: userId,
        visibility: "public",
      });
      const alpha = await testApp.createWorkbook({
        name: "Alpha",
        createdBy: userId,
        visibility: "public",
      });
      const bravo = await testApp.createWorkbook({
        name: "Bravo",
        createdBy: userId,
        visibility: "public",
      });

      const result = await useCase.executePaginated(1, 20, {
        userId,
        sort: [{ field: "activity", direction: "desc" }],
      });

      assertSuccess(result);
      expect(result.value.activityAvailable).toBe(false);
      expect(result.value.items.map((item) => item.id)).toEqual([alpha.id, bravo.id, charlie.id]);
    });

    it("orders items consistently with the activity measurements it reports", async () => {
      const busy = await testApp.createWorkbook({
        name: "Busy workbook",
        createdBy: userId,
        visibility: "public",
      });
      const quiet = await testApp.createWorkbook({
        name: "Quiet workbook",
        createdBy: userId,
        visibility: "public",
      });
      const [busyVersion, quietVersion] = await testApp.database
        .insert(workbookVersions)
        .values([
          {
            workbookId: busy.id,
            version: 1,
            cells: [],
            metadata: {},
            entitySnapshots: { protocols: {}, macros: {} },
            createdBy: userId,
          },
          {
            workbookId: quiet.id,
            version: 1,
            cells: [],
            metadata: {},
            entitySnapshots: { protocols: {}, macros: {} },
            createdBy: userId,
          },
        ])
        .returning();

      const adapter = testApp.module.get(DatabricksAdapter);
      const today = new Date().toISOString().slice(0, 10);
      vi.spyOn(adapter, "getResourceDailyActivity").mockResolvedValue(
        success([
          {
            date: today,
            resourceType: "workbook_version",
            resourceId: busyVersion.id,
            measurements: 9,
          },
          {
            date: today,
            resourceType: "workbook_version",
            resourceId: quietVersion.id,
            measurements: 1,
          },
        ]),
      );
      await testApp.module
        .get<CachePort>(CACHE_PORT)
        .invalidate(resourceMetricsCacheKey("workbook"));

      const result = await useCase.executePaginated(1, 20, {
        userId,
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
      const busy = await testApp.createWorkbook({
        name: "Zulu workbook",
        createdBy: userId,
        visibility: "public",
      });
      const quiet = await testApp.createWorkbook({
        name: "Alpha workbook",
        createdBy: userId,
        visibility: "public",
      });
      const [busyVersion, quietVersion] = await testApp.database
        .insert(workbookVersions)
        .values([
          {
            workbookId: busy.id,
            version: 1,
            cells: [],
            metadata: {},
            entitySnapshots: { protocols: {}, macros: {} },
            createdBy: userId,
          },
          {
            workbookId: quiet.id,
            version: 1,
            cells: [],
            metadata: {},
            entitySnapshots: { protocols: {}, macros: {} },
            createdBy: userId,
          },
        ])
        .returning();

      const adapter = testApp.module.get(DatabricksAdapter);
      const today = new Date().toISOString().slice(0, 10);
      vi.spyOn(adapter, "getResourceDailyActivity").mockResolvedValue(
        success([
          {
            date: today,
            resourceType: "workbook_version",
            resourceId: busyVersion.id,
            measurements: 9,
          },
          {
            date: today,
            resourceType: "workbook_version",
            resourceId: quietVersion.id,
            measurements: 1,
          },
        ]),
      );
      await testApp.module
        .get<CachePort>(CACHE_PORT)
        .invalidate(resourceMetricsCacheKey("workbook"));

      const result = await useCase.execute({
        userId,
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
      const charlie = await testApp.createWorkbook({
        name: "Charlie",
        createdBy: userId,
        visibility: "public",
      });
      const alpha = await testApp.createWorkbook({
        name: "Alpha",
        createdBy: userId,
        visibility: "public",
      });

      const result = await useCase.execute({
        userId,
        sort: [{ field: "activity", direction: "desc" }],
      });

      assertSuccess(result);
      expect(result.value.map((item) => item.id)).toEqual([alpha.id, charlie.id]);
    });
  });
});
