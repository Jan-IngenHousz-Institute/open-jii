import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import { zScopedMetricsResponse } from "@repo/api/domains/metrics/metrics.schema";

import { MetricsCacheAdapter } from "../../common/modules/cache/metrics-cache.adapter";
import { DatabricksAdapter } from "../../common/modules/databricks/databricks.adapter";
import { success } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";

const windows = {
  measurements24h: 140,
  measurements30d: 4_000,
  experiments30d: 23,
  contributors30d: 31,
  devices30d: 12,
  lastMeasurementAt: "2026-08-28 10:00:00",
  computedAt: "2026-08-28 10:05:00",
};

describe("ScopedMetricsController", () => {
  const testApp = TestHarness.App;
  let userId: string;
  let organizationId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();

    userId = await testApp.createTestUser({});
    organizationId = await testApp.createOrganization();
    await testApp.addOrganizationMember(organizationId, userId, "member");
    await testApp.module.get(MetricsCacheAdapter).invalidate(`scoped-org-${organizationId}`);

    const adapter = testApp.module.get(DatabricksAdapter);
    vi.spyOn(adapter, "getActivityWindows").mockResolvedValue(success(windows));
    vi.spyOn(adapter, "getScopedDailyActivity").mockResolvedValue(success([]));
    vi.spyOn(adapter, "getContributorPairs").mockResolvedValue(success([]));
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("requires authentication", async () => {
    const response = await testApp
      .get(testApp.resolveOrpcPath(contract.metrics.getScopedMetrics))
      .query({ scope: "organization", organizationId })
      .withoutAuth();

    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
  });

  it("serves org scope with the platform baseline to a member", async () => {
    const response = await testApp
      .get(testApp.resolveOrpcPath(contract.metrics.getScopedMetrics))
      .query({ scope: "organization", organizationId })
      .withAuth(userId);

    expect(response.status).toBe(StatusCodes.OK);
    const body = zScopedMetricsResponse.parse(response.body);
    expect(body.scope).toBe("organization");
    expect(body.baseline.measurements30d).toBe(4_000);
    expect(body.scoped.measurements30d).toBe(0);
  });

  it("rejects org scope for non-members", async () => {
    const outsiderId = await testApp.createTestUser({});
    const response = await testApp
      .get(testApp.resolveOrpcPath(contract.metrics.getScopedMetrics))
      .query({ scope: "organization", organizationId })
      .withAuth(outsiderId);

    expect(response.status).toBe(StatusCodes.FORBIDDEN);
  });
});
