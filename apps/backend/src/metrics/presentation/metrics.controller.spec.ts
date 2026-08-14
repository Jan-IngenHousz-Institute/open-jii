import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import { zPublicMetricsResponse } from "@repo/api/domains/metrics/metrics.schema";

import { DatabricksAdapter } from "../../common/modules/databricks/databricks.adapter";
import { AppError, failure, success } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";

describe("MetricsController", () => {
  const testApp = TestHarness.App;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();

    const adapter = testApp.module.get(DatabricksAdapter);
    vi.spyOn(adapter, "getPublicPlatformTotals").mockResolvedValue(success(null));
    vi.spyOn(adapter, "getPublicDailyActivity").mockResolvedValue(success([]));
    vi.spyOn(adapter, "getPublicFamilyTotals").mockResolvedValue(success([]));
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("serves metrics without a session", async () => {
    const response = await testApp.get(testApp.resolveOrpcPath(contract.metrics.getPublicMetrics));

    expect(response.status).toBe(StatusCodes.OK);

    // Parsing with the public schema doubles as a contract-conformance check.
    const body = zPublicMetricsResponse.parse(response.body);
    expect(body.totals).toBeNull();
    expect(body.dailyActivity).toEqual([]);
    expect(body.familyTotals).toEqual([]);
    expect(body.registry.registeredUsers).toBeGreaterThanOrEqual(0);
  });

  it("still answers anonymously when the warehouse is down", async () => {
    const adapter = testApp.module.get(DatabricksAdapter);
    const warehouseDown = failure(AppError.internal("warehouse down"));
    vi.spyOn(adapter, "getPublicPlatformTotals").mockResolvedValue(warehouseDown);
    vi.spyOn(adapter, "getPublicDailyActivity").mockResolvedValue(warehouseDown);
    vi.spyOn(adapter, "getPublicFamilyTotals").mockResolvedValue(warehouseDown);

    const response = await testApp.get(testApp.resolveOrpcPath(contract.metrics.getPublicMetrics));

    expect(response.status).toBe(StatusCodes.OK);
    expect(zPublicMetricsResponse.parse(response.body).totals).toBeNull();
  });
});
