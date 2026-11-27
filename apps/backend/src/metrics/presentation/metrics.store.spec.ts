import { CACHE_MANAGER } from "@nestjs/cache-manager";
import type { Cache } from "cache-manager";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

import { FEATURE_FLAGS } from "@repo/analytics";
import { contract } from "@repo/api/contract";
import type {
  PublicMetricsResponse,
  ScopedMetricsResponse,
} from "@repo/api/domains/metrics/metrics.schema";

import { AnalyticsAdapter } from "../../common/modules/analytics/analytics.adapter";
import type { MockAnalyticsAdapter } from "../../test/mocks/adapters/analytics.adapter.mock";
import { emptyStore } from "../../test/store-admin";
import { storeRefreshedViews } from "../../test/store-migrations";
import { TestHarness } from "../../test/test-harness";
import type { SuperTestResponse } from "../../test/test-harness";
import { publicMetricsCacheKey } from "../application/use-cases/get-public-metrics/get-public-metrics";
import { scopedInputsCacheKey } from "../application/use-cases/get-scoped-metrics/get-scoped-metrics";
import { CACHE_PORT } from "../core/ports/cache.port";
import type { CachePort } from "../core/ports/cache.port";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const zPending = z.tuple([z.object({ pending: z.coerce.number() })]);

/** A time as the store takes it, in UTC. */
function storeTime(time: Date): string {
  return time.toISOString().replace("T", " ").replace("Z", "");
}

describe("The platform metrics, read from the serving store's hourly views", () => {
  const testApp = TestHarness.App;
  let ada: string;
  let ben: string;
  let plots: string;

  /** A measurement as the feed writes it, the metrics' windows counting back from now. */
  function measurement(experimentId: string, id: number, userId: string, hoursAgo: number) {
    const now = Date.now();
    return {
      experiment_id: experimentId,
      id,
      device_id: `d${id}`,
      client_id: `c${id}`,
      user_id: userId,
      timestamp: storeTime(new Date(now - hoursAgo * HOUR)),
      timezone: "UTC",
      hour_local: new Date(now - hoursAgo * HOUR).getUTCHours(),
      questions_data: {},
      annotations: [],
      data: '{"par":120}',
      _commit_version: 1,
      _commit_timestamp: storeTime(new Date(now)),
    };
  }

  /**
   * Recounts the metrics views over the rows seeded since, each after the views it reads. The
   * refresh each view runs when the migrations make it is waited out first, since it would miss
   * rows inserted while it runs.
   */
  async function refreshMetricsViews() {
    for (let attempt = 0; ; attempt++) {
      const result = await testApp.store.query({
        query:
          "SELECT countIf(last_success_time IS NULL) AS pending FROM system.view_refreshes WHERE database = 'store'",
        format: "JSONEachRow",
      });
      const [{ pending }] = zPending.parse(await result.json());
      if (pending === 0) {
        break;
      }
      if (attempt === 120) {
        throw new Error("The metrics views never finished their first refresh");
      }
      await new Promise((done) => setTimeout(done, 500));
    }

    for (const view of storeRefreshedViews()) {
      await testApp.store.command({ query: `SYSTEM REFRESH VIEW store.${view}` });
      await testApp.store.command({ query: `SYSTEM WAIT VIEW store.${view}` });
    }
  }

  /** How long the public snapshot stays fresh, once the load behind a request has stored it. */
  async function snapshotFreshFor(): Promise<number> {
    const cache = testApp.module.get<Cache>(CACHE_MANAGER);
    const key = `metrics:${publicMetricsCacheKey("store")}`;
    const held = await vi.waitFor(
      async () => {
        const envelope = await cache.get<{ freshUntil: number }>(key);
        if (envelope === undefined) {
          throw new Error("The public snapshot is not stored yet");
        }
        return envelope;
      },
      { timeout: 10_000 },
    );
    return held.freshUntil - Date.now();
  }

  beforeAll(async () => {
    await testApp.setup({ mock: { AnalyticsAdapter: true } });
    // The harness empties only what a spec wrote through it, and the platform-wide counts below
    // must not include rows another spec seeded on its own.
    await emptyStore(testApp.store);
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    const analytics: MockAnalyticsAdapter = testApp.module.get(AnalyticsAdapter);
    analytics.setFlag(FEATURE_FLAGS.STORE_EXPERIMENT_READS, true);
    const cache = testApp.module.get<CachePort>(CACHE_PORT);
    await cache.invalidate(publicMetricsCacheKey("store"));
    await cache.invalidate(scopedInputsCacheKey("store"));

    ada = await testApp.createTestUser({ name: "Ada Lovelace" });
    ben = await testApp.createTestUser({ name: "Ben Okri" });
    plots = (await testApp.createExperiment({ name: "Plots", userId: ada })).experiment.id;
    await testApp.addExperimentCollaborator(plots, ben);
    const leaves = (await testApp.createExperiment({ name: "Leaves", userId: ben })).experiment.id;

    // Two measurements in Ada's experiment, by both of them, and one in Ben's, two of the three
    // within the last day.
    await testApp.store.insert({
      table: "measurements",
      values: [
        measurement(plots, 1, ada, 1),
        measurement(plots, 2, ben, 72),
        measurement(leaves, 3, ben, 2),
      ],
      format: "JSONEachRow",
    });
    await refreshMetricsViews();
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("counts every experiment's measurements on the public page", async () => {
    const path = testApp.resolveOrpcPath(contract.metrics.getPublicMetrics);

    const response: SuperTestResponse<PublicMetricsResponse> = await testApp
      .get(path)
      .expect(StatusCodes.OK);

    expect(response.body.hero?.totalMeasurements).toBe(3);
    expect(response.body.liveness?.measurements24h).toBe(2);
    expect(response.body.community?.activeExperiments30d).toBe(2);
    expect(response.body.activity.reduce((sum, day) => sum + day.measurements, 0)).toBe(3);
  });

  it("holds the public snapshot for the hour once every view has refreshed, though no parameter qualified", async () => {
    const path = testApp.resolveOrpcPath(contract.metrics.getPublicMetrics);

    // The seeded measurements carry no readings, so the parameter view counts nothing.
    await testApp.get(path).expect(StatusCodes.OK);

    expect(await snapshotFreshFor()).toBeGreaterThan(30 * MINUTE);
  });

  it("asks for the public snapshot again within minutes while the parameter view has not refreshed", async () => {
    const path = testApp.resolveOrpcPath(contract.metrics.getPublicMetrics);
    // Holding no rows at all, as the view does before its first refresh.
    await testApp.store.command({ query: "SYSTEM STOP VIEW store.metrics_parameter_stats" });
    await testApp.store.command({ query: "TRUNCATE TABLE store.metrics_parameter_stats" });

    try {
      await testApp.get(path).expect(StatusCodes.OK);

      expect(await snapshotFreshFor()).toBeLessThanOrEqual(5 * MINUTE);
    } finally {
      await testApp.store.command({ query: "SYSTEM START VIEW store.metrics_parameter_stats" });
      await testApp.store.command({ query: "SYSTEM REFRESH VIEW store.metrics_parameter_stats" });
      await testApp.store.command({ query: "SYSTEM WAIT VIEW store.metrics_parameter_stats" });
    }
  });

  it("counts a member's experiment apart from the platform it is compared with", async () => {
    const path = testApp.resolveOrpcPath(contract.metrics.getScopedMetrics);

    const response: SuperTestResponse<ScopedMetricsResponse> = await testApp
      .get(path)
      .query({ scope: "experiment", experimentId: plots })
      .withAuth(ben)
      .expect(StatusCodes.OK);

    expect(response.body.scoped).toMatchObject({
      measurements30d: 2,
      activeExperiments30d: 1,
      contributors30d: 2,
    });
    expect(response.body.baseline).toEqual({ measurements30d: 3, activeExperiments30d: 2 });
  });

  it("refuses an experiment's figures to someone who is not a member", async () => {
    const stranger = await testApp.createTestUser({ name: "Cleo Stranger" });
    const path = testApp.resolveOrpcPath(contract.metrics.getScopedMetrics);

    await testApp
      .get(path)
      .query({ scope: "experiment", experimentId: plots })
      .withAuth(stranger)
      .expect(StatusCodes.FORBIDDEN);
  });
});
