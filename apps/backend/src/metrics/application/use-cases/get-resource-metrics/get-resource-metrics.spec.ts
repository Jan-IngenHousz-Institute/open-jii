import { DatabricksAdapter } from "../../../../common/modules/databricks/databricks.adapter";
import { AppError, assertSuccess, failure, success } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { CACHE_PORT } from "../../../core/ports/cache.port";
import type { CachePort } from "../../../core/ports/cache.port";
import { resourceMetricsCacheKey } from "../../resource-metrics.service";
import { GetResourceMetricsUseCase } from "./get-resource-metrics";

/** Dates relative to today: the window slides, so fixed ones would age out. */
const daysAgo = (offset: number) =>
  new Date(Date.now() - offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const YESTERDAY = daysAgo(1);
const TWO_DAYS_AGO = daysAgo(2);

describe("GetResourceMetricsUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: GetResourceMetricsUseCase;
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
    useCase = testApp.module.get(GetResourceMetricsUseCase);
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

  it("totals only the resources the caller may read", async () => {
    const result = await useCase.execute("protocol", ownerId);

    assertSuccess(result);
    // The private protocol's 999 measurements must not reach the header.
    expect(result.value.totalMeasurements).toBe(102);
    expect(result.value.activeCount).toBe(1);
    expect(result.value.windowDays).toBe(30);
  });

  it("reports nothing when the warehouse is unavailable", async () => {
    vi.spyOn(adapter, "getResourceDailyActivity").mockResolvedValue(
      failure(AppError.internal("warehouse down")),
    );

    const result = await useCase.execute("protocol", ownerId);

    assertSuccess(result);
    expect(result.value.totalMeasurements).toBe(0);
    expect(result.value.activeCount).toBe(0);
  });
});
