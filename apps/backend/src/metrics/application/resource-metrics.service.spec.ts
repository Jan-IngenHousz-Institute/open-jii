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
});
