import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import { zResourceMetricsResponse } from "@repo/api/domains/metrics/metrics.schema";

import { DatabricksAdapter } from "../../common/modules/databricks/databricks.adapter";
import { AppError, failure, success } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";
import { resourceMetricsCacheKey } from "../application/resource-metrics.service";
import { CACHE_PORT } from "../core/ports/cache.port";
import type { CachePort } from "../core/ports/cache.port";

/** Dates relative to today: the window slides, so fixed ones would age out. */
const daysAgo = (offset: number) =>
  new Date(Date.now() - offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

describe("ResourceMetricsController", () => {
  const testApp = TestHarness.App;
  let adapter: DatabricksAdapter;
  let userId: string;
  let protocolId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();

    adapter = testApp.module.get(DatabricksAdapter);
    userId = await testApp.createTestUser({});

    const protocol = await testApp.createProtocol({
      name: "Public protocol",
      createdBy: userId,
      visibility: "public",
    });
    protocolId = protocol.id;

    vi.spyOn(adapter, "getResourceDailyActivity").mockResolvedValue(
      success([
        {
          date: daysAgo(1),
          resourceType: "protocol",
          resourceId: protocolId,
          measurements: 62,
        },
      ]),
    );

    await testApp.module.get<CachePort>(CACHE_PORT).invalidate(resourceMetricsCacheKey("protocol"));
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("requires authentication", async () => {
    const response = await testApp
      .get(testApp.resolveOrpcPath(contract.metrics.getResourceMetrics))
      .query({ kind: "protocol" })
      .withoutAuth();

    expect(response.status).toBe(StatusCodes.UNAUTHORIZED);
  });

  it("serves the window a list header states", async () => {
    const response = await testApp
      .get(testApp.resolveOrpcPath(contract.metrics.getResourceMetrics))
      .query({ kind: "protocol" })
      .withAuth(userId);

    expect(response.status).toBe(StatusCodes.OK);
    const body = zResourceMetricsResponse.parse(response.body);
    expect(body.kind).toBe("protocol");
    expect(body.totalMeasurements).toBe(62);
    expect(body.activeCount).toBe(1);
    expect(body.days).toHaveLength(body.windowDays);
  });

  it("serves empty slots rather than an error when the warehouse is down", async () => {
    vi.spyOn(adapter, "getResourceDailyActivity").mockResolvedValue(
      failure(AppError.internal("warehouse down")),
    );

    const response = await testApp
      .get(testApp.resolveOrpcPath(contract.metrics.getResourceMetrics))
      .query({ kind: "macro" })
      .withAuth(userId);

    expect(response.status).toBe(StatusCodes.OK);
    const body = zResourceMetricsResponse.parse(response.body);
    expect(body.totalMeasurements).toBe(0);
    expect(body.peak).toBeNull();
  });

  it("refuses a kind the contract does not name", async () => {
    const response = await testApp
      .get(testApp.resolveOrpcPath(contract.metrics.getResourceMetrics))
      .query({ kind: "spreadsheet" })
      .withAuth(userId);

    expect(response.status).toBe(StatusCodes.BAD_REQUEST);
  });
});
