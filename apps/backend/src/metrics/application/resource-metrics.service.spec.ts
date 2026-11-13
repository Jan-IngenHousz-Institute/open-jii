import { workbookVersions } from "@repo/database";

import { DatabricksAdapter } from "../../common/modules/databricks/databricks.adapter";
import { AppError, failure, success } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";
import { CACHE_PORT } from "../core/ports/cache.port";
import type { CachePort } from "../core/ports/cache.port";
import { MetricsRepository } from "../core/repositories/metrics.repository";
import { ResourceMetricsService, resourceMetricsCacheKey } from "./resource-metrics.service";

/** Dates relative to today: the window slides, so fixed ones would age out. */
const daysAgo = (offset: number) =>
  new Date(Date.now() - offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const YESTERDAY = daysAgo(1);
const TWO_DAYS_AGO = daysAgo(2);
const LAST_WINDOW = daysAgo(40);

describe("ResourceMetricsService", () => {
  const testApp = TestHarness.App;
  let service: ResourceMetricsService;
  let adapter: DatabricksAdapter;
  let ownerId: string;
  let outsiderId: string;
  let visibleProtocolId: string;
  let privateProtocolId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();

    adapter = testApp.module.get(DatabricksAdapter);
    service = testApp.module.get(ResourceMetricsService);
    ownerId = await testApp.createTestUser({});
    outsiderId = await testApp.createTestUser({});

    const visible = await testApp.createProtocol({
      name: "Public protocol",
      createdBy: ownerId,
      visibility: "public",
    });
    visibleProtocolId = visible.id;

    const hidden = await testApp.createProtocol({
      name: "Private protocol",
      createdBy: outsiderId,
      visibility: "private",
    });
    privateProtocolId = hidden.id;

    vi.spyOn(adapter, "getResourceDailyActivity").mockResolvedValue(
      success([
        {
          date: TWO_DAYS_AGO,
          resourceType: "protocol",
          resourceId: visibleProtocolId,
          measurements: 40,
        },
        {
          date: YESTERDAY,
          resourceType: "protocol",
          resourceId: visibleProtocolId,
          measurements: 62,
        },
        {
          date: YESTERDAY,
          resourceType: "protocol",
          resourceId: privateProtocolId,
          measurements: 999,
        },
        {
          date: LAST_WINDOW,
          resourceType: "protocol",
          resourceId: visibleProtocolId,
          measurements: 250,
        },
      ]),
    );

    // The cached rows key on the previous test's resource ids, so the clear
    // has to follow the fixtures rather than precede them.
    await testApp.module.get<CachePort>(CACHE_PORT).invalidate(resourceMetricsCacheKey("protocol"));
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("returns a dense daily series for the rows it was given", async () => {
    const snapshot = await service.activitySnapshot("protocol");

    const resource = snapshot?.seriesFor([visibleProtocolId]).get(visibleProtocolId);
    expect(resource?.measurements).toBe(102);
    // The window is complete so every row's sparkline is the same length.
    expect(resource?.days).toHaveLength(30);
    expect(resource?.days.filter((day) => day.measurements > 0)).toEqual([
      { date: TWO_DAYS_AGO, measurements: 40 },
      { date: YESTERDAY, measurements: 62 },
    ]);
  });

  it("snapshots current-window totals for the whole kind and omits previous-only and zero totals", async () => {
    vi.spyOn(adapter, "getResourceDailyActivity").mockResolvedValue(
      success([
        {
          date: YESTERDAY,
          resourceType: "protocol",
          resourceId: visibleProtocolId,
          measurements: 12,
        },
        {
          date: LAST_WINDOW,
          resourceType: "protocol",
          resourceId: outsiderId,
          measurements: 90,
        },
        {
          date: YESTERDAY,
          resourceType: "protocol",
          resourceId: ownerId,
          measurements: 0,
        },
      ]),
    );
    const cache = testApp.module.get<CachePort>(CACHE_PORT);
    await cache.invalidate(resourceMetricsCacheKey("protocol"));

    const snapshot = await service.activitySnapshot("protocol");

    expect(snapshot?.totals).toEqual(new Map([[visibleProtocolId, 12]]));
    expect(snapshot?.totals.has(outsiderId)).toBe(false);
    expect(snapshot?.totals.has(ownerId)).toBe(false);
  });

  it("reads the kind cache once for an activity snapshot", async () => {
    const cache = testApp.module.get<CachePort>(CACHE_PORT);
    await cache.invalidate(resourceMetricsCacheKey("protocol"));
    const tryCache = vi.spyOn(cache, "tryCache");

    const snapshot = await service.activitySnapshot("protocol");

    expect(snapshot).not.toBeNull();
    expect(tryCache).toHaveBeenCalledTimes(1);
    expect(tryCache).toHaveBeenCalledWith(
      resourceMetricsCacheKey("protocol"),
      expect.any(Function),
    );
  });

  it("drops warehouse ids that are not UUIDs from the snapshot", async () => {
    vi.spyOn(adapter, "getResourceDailyActivity").mockResolvedValue(
      success([
        { date: YESTERDAY, resourceType: "protocol", resourceId: "not-a-uuid", measurements: 8 },
        {
          date: YESTERDAY,
          resourceType: "protocol",
          resourceId: visibleProtocolId,
          measurements: 3,
        },
      ]),
    );
    await testApp.module.get<CachePort>(CACHE_PORT).invalidate(resourceMetricsCacheKey("protocol"));

    const snapshot = await service.activitySnapshot("protocol");

    expect(snapshot?.totals).toEqual(new Map([[visibleProtocolId, 3]]));
    expect(snapshot?.seriesFor(["not-a-uuid"]).size).toBe(0);
  });

  it("returns null from a snapshot when the warehouse read fails", async () => {
    vi.spyOn(adapter, "getResourceDailyActivity").mockResolvedValue(
      failure(AppError.internal("warehouse down")),
    );
    await testApp.module.get<CachePort>(CACHE_PORT).invalidate(resourceMetricsCacheKey("protocol"));

    await expect(service.activitySnapshot("protocol")).resolves.toBeNull();
  });

  it("states the window against the one before it", async () => {
    const totals = await service.totalsFor("protocol", [visibleProtocolId]);

    expect(totals.measurements).toBe(102);
    expect(totals.previousMeasurements).toBe(250);
    expect(totals.activeCount).toBe(1);
    expect(totals.activeDays).toBe(2);
    expect(totals.peak).toEqual({ date: YESTERDAY, measurements: 62 });
    expect(totals.lastActivityDate).toBe(YESTERDAY);
    expect(totals.busiest).toEqual({ id: visibleProtocolId, measurements: 102 });
    expect(totals.days).toHaveLength(30);
  });

  it("counts only the resources the caller may read", async () => {
    const totals = await service.totalsFor("protocol", [visibleProtocolId]);

    expect(totals.measurements).toBe(102);
  });

  it("reports an empty window when the warehouse is unavailable", async () => {
    vi.spyOn(adapter, "getResourceDailyActivity").mockResolvedValue(
      failure(AppError.internal("warehouse down")),
    );

    const totals = await service.totalsFor("protocol", [visibleProtocolId]);

    expect(totals.measurements).toBe(0);
    expect(totals.peak).toBeNull();
    expect(totals.busiest).toBeNull();
    expect(totals.days).toHaveLength(30);
  });

  it("returns nothing for a resource the caller did not ask about", async () => {
    const snapshot = await service.activitySnapshot("protocol");

    expect(snapshot?.seriesFor([visibleProtocolId]).has(privateProtocolId)).toBe(false);
  });

  it("reads experiment activity from the scoped rows it already has", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Collecting experiment",
      userId: ownerId,
    });
    vi.spyOn(adapter, "getScopedDailyActivity").mockResolvedValue(
      success([{ date: YESTERDAY, experimentId: experiment.id, measurements: 5 }]),
    );
    await testApp.module
      .get<CachePort>(CACHE_PORT)
      .invalidate(resourceMetricsCacheKey("experiment"));

    const snapshot = await service.activitySnapshot("experiment");

    expect(snapshot?.seriesFor([experiment.id]).get(experiment.id)?.measurements).toBe(5);
  });

  it("folds a workbook version's rows onto the workbook that owns them", async () => {
    const workbook = await testApp.createWorkbook({ name: "Collecting", createdBy: ownerId });
    const [version] = await testApp.database
      .insert(workbookVersions)
      .values({
        workbookId: workbook.id,
        version: 1,
        cells: [],
        metadata: {},
        entitySnapshots: { protocols: {}, macros: {} },
        createdBy: ownerId,
      })
      .returning();

    vi.spyOn(adapter, "getResourceDailyActivity").mockResolvedValue(
      success([
        {
          date: YESTERDAY,
          resourceType: "workbook_version",
          resourceId: version.id,
          measurements: 7,
        },
      ]),
    );
    await testApp.module.get<CachePort>(CACHE_PORT).invalidate(resourceMetricsCacheKey("workbook"));

    const snapshot = await service.activitySnapshot("workbook");
    const totals = await service.totalsFor("workbook", [workbook.id]);

    expect(snapshot?.seriesFor([workbook.id]).get(workbook.id)?.measurements).toBe(7);
    expect(totals.measurements).toBe(7);
  });

  it("resolves workbook versions once per cache fill, not once per read", async () => {
    const versionMap = vi.spyOn(
      testApp.module.get(MetricsRepository),
      "getWorkbookVersionMapForVersions",
    );
    await testApp.module.get<CachePort>(CACHE_PORT).invalidate(resourceMetricsCacheKey("workbook"));

    await service.activitySnapshot("workbook");
    await service.activitySnapshot("workbook");
    await service.totalsFor("workbook", [visibleProtocolId]);

    expect(versionMap).toHaveBeenCalledTimes(1);
  });

  it("sums snapshot activity across every version of each workbook", async () => {
    const workbook = await testApp.createWorkbook({ name: "Collecting", createdBy: ownerId });
    const otherWorkbook = await testApp.createWorkbook({ name: "Other", createdBy: ownerId });
    const versions = await testApp.database
      .insert(workbookVersions)
      .values([
        {
          workbookId: workbook.id,
          version: 1,
          cells: [],
          metadata: {},
          entitySnapshots: { protocols: {}, macros: {} },
          createdBy: ownerId,
        },
        {
          workbookId: workbook.id,
          version: 2,
          cells: [],
          metadata: {},
          entitySnapshots: { protocols: {}, macros: {} },
          createdBy: ownerId,
        },
        {
          workbookId: otherWorkbook.id,
          version: 1,
          cells: [],
          metadata: {},
          entitySnapshots: { protocols: {}, macros: {} },
          createdBy: ownerId,
        },
      ])
      .returning();
    vi.spyOn(adapter, "getResourceDailyActivity").mockResolvedValue(
      success([
        {
          date: YESTERDAY,
          resourceType: "workbook_version",
          resourceId: versions[0].id,
          measurements: 7,
        },
        {
          date: TWO_DAYS_AGO,
          resourceType: "workbook_version",
          resourceId: versions[1].id,
          measurements: 5,
        },
        {
          date: YESTERDAY,
          resourceType: "workbook_version",
          resourceId: versions[2].id,
          measurements: 11,
        },
      ]),
    );
    await testApp.module.get<CachePort>(CACHE_PORT).invalidate(resourceMetricsCacheKey("workbook"));

    const snapshot = await service.activitySnapshot("workbook");

    expect(snapshot?.totals).toEqual(
      new Map([
        [workbook.id, 12],
        [otherWorkbook.id, 11],
      ]),
    );
    expect(snapshot?.seriesFor([workbook.id]).get(workbook.id)?.measurements).toBe(12);
  });

  it("returns null when workbook version attribution fails", async () => {
    vi.spyOn(
      testApp.module.get(MetricsRepository),
      "getWorkbookVersionMapForVersions",
    ).mockResolvedValue(failure(AppError.internal("version map unavailable")));
    await testApp.module.get<CachePort>(CACHE_PORT).invalidate(resourceMetricsCacheKey("workbook"));

    await expect(service.activitySnapshot("workbook")).resolves.toBeNull();
  });

  it("asks for nothing when the caller passed no ids", async () => {
    const snapshot = await service.activitySnapshot("protocol");
    const series = snapshot?.seriesFor([]) ?? new Map();
    const totals = await service.totalsFor("protocol", []);

    expect(series.size).toBe(0);
    expect(totals.measurements).toBe(0);
  });
  it("drops a cached row that has aged out of the window, from every figure", async () => {
    vi.spyOn(adapter, "getResourceDailyActivity").mockResolvedValue(
      success([
        {
          date: daysAgo(35),
          resourceType: "protocol",
          resourceId: visibleProtocolId,
          measurements: 99,
        },
      ]),
    );
    await testApp.module.get<CachePort>(CACHE_PORT).invalidate(resourceMetricsCacheKey("protocol"));

    const totals = await service.totalsFor("protocol", [visibleProtocolId]);

    // It belongs to the previous window, so it counts there and nowhere else.
    expect(totals.previousMeasurements).toBe(99);
    expect(totals.measurements).toBe(0);
    expect(totals.activeCount).toBe(0);
    expect(totals.busiest).toBeNull();
  });

  it("ignores a row that belongs to neither window", async () => {
    vi.spyOn(adapter, "getResourceDailyActivity").mockResolvedValue(
      success([
        {
          date: daysAgo(120),
          resourceType: "protocol",
          resourceId: visibleProtocolId,
          measurements: 99,
        },
      ]),
    );
    await testApp.module.get<CachePort>(CACHE_PORT).invalidate(resourceMetricsCacheKey("protocol"));

    const totals = await service.totalsFor("protocol", [visibleProtocolId]);

    expect(totals.measurements).toBe(0);
    expect(totals.previousMeasurements).toBe(0);
    expect(totals.activeCount).toBe(0);
    expect(totals.busiest).toBeNull();
  });
});
