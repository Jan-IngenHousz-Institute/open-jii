import { workbookVersions } from "@repo/database";

import { DatabricksAdapter } from "../../common/modules/databricks/databricks.adapter";
import { AppError, failure, success } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";
import { CACHE_PORT } from "../core/ports/cache.port";
import type { CachePort } from "../core/ports/cache.port";
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
    const series = await service.seriesFor("protocol", [visibleProtocolId]);

    const resource = series.get(visibleProtocolId);
    expect(resource?.measurements).toBe(102);
    // The window is complete so every row's sparkline is the same length.
    expect(resource?.days).toHaveLength(30);
    expect(resource?.days.filter((day) => day.measurements > 0)).toEqual([
      { date: TWO_DAYS_AGO, measurements: 40 },
      { date: YESTERDAY, measurements: 62 },
    ]);
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
    const series = await service.seriesFor("protocol", [visibleProtocolId]);

    expect(series.has(privateProtocolId)).toBe(false);
  });

  it("returns no series at all when the warehouse is unavailable", async () => {
    vi.spyOn(adapter, "getResourceDailyActivity").mockResolvedValue(
      failure(AppError.internal("warehouse down")),
    );

    const series = await service.seriesFor("protocol", [visibleProtocolId]);

    expect(series.size).toBe(0);
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

    const series = await service.seriesFor("experiment", [experiment.id]);

    expect(series.get(experiment.id)?.measurements).toBe(5);
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

    const series = await service.seriesFor("workbook", [workbook.id]);

    expect(series.get(workbook.id)?.measurements).toBe(7);
  });

  it("asks for nothing when the caller passed no ids", async () => {
    const series = await service.seriesFor("protocol", []);
    const totals = await service.totalsFor("protocol", []);

    expect(series.size).toBe(0);
    expect(totals.measurements).toBe(0);
  });
});
