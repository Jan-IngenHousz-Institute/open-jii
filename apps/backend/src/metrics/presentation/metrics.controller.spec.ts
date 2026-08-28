import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import { zPublicMetricsResponse } from "@repo/api/domains/metrics/metrics.schema";

import { MetricsCacheAdapter } from "../../common/modules/cache/metrics-cache.adapter";
import { DatabricksAdapter } from "../../common/modules/databricks/databricks.adapter";
import { AppError, failure, success } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";
import { PUBLIC_METRICS_CACHE_KEY } from "../application/use-cases/get-public-metrics/get-public-metrics";

describe("MetricsController", () => {
  const testApp = TestHarness.App;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();

    // The snapshot key is shared, so each test starts from a cold cache.
    await testApp.module.get(MetricsCacheAdapter).invalidate(PUBLIC_METRICS_CACHE_KEY);

    const adapter = testApp.module.get(DatabricksAdapter);
    const warehouseDown = failure(AppError.internal("warehouse down"));
    vi.spyOn(adapter, "getPublicPlatformTotals").mockResolvedValue(warehouseDown);
    vi.spyOn(adapter, "getPublicDailyActivity").mockResolvedValue(warehouseDown);
    vi.spyOn(adapter, "getPublicFamilyTotals").mockResolvedValue(warehouseDown);
    vi.spyOn(adapter, "getActivityWindows").mockResolvedValue(warehouseDown);
    vi.spyOn(adapter, "getHourlyActivity").mockResolvedValue(warehouseDown);
    vi.spyOn(adapter, "getTopParameter").mockResolvedValue(warehouseDown);
    vi.spyOn(adapter, "getPoolFacts").mockResolvedValue(warehouseDown);
    vi.spyOn(adapter, "getContributorPairs").mockResolvedValue(success([]));
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("serves an empty-but-valid snapshot anonymously when the warehouse is down", async () => {
    const response = await testApp.get(testApp.resolveOrpcPath(contract.metrics.getPublicMetrics));

    expect(response.status).toBe(StatusCodes.OK);

    // Parsing with the public schema doubles as a contract-conformance check.
    const body = zPublicMetricsResponse.parse(response.body);
    expect(body.hero).toBeNull();
    expect(body.liveness).toBeNull();
    expect(body.activity).toEqual([]);
    expect(body.captions.map((caption) => caption.kind)).not.toContain("streak");
  });
});
