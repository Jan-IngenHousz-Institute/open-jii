import { DatabricksAdapter } from "../../../../common/modules/databricks/databricks.adapter";
import { AppError, assertSuccess, failure, success } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { CACHE_PORT } from "../../../core/ports/cache.port";
import type { CachePort } from "../../../core/ports/cache.port";
import { MetricsRepository } from "../../../core/repositories/metrics.repository";
import { GetPublicMetricsUseCase, PUBLIC_METRICS_CACHE_KEY } from "./get-public-metrics";

const totals = {
  totalMeasurements: 1_000_000,
  totalVolumeBytes: 6_000_000,
  totalUploadedRows: 50,
  totalMacroExecutions: 200,
  devicesAllTime: 9,
  experimentsWithData: 5,
  firstMeasurementAt: "2024-01-01 00:00:00",
  lastMeasurementAt: "2026-08-28 10:00:00",
  computedAt: "2026-08-28 10:05:00",
};

const daily = [
  {
    date: "2026-08-25",
    measurements: 100,
    cumulativeMeasurements: 999_800,
    volumeBytes: 2_000_000,
  },
  { date: "2026-08-27", measurements: 80, cumulativeMeasurements: 999_880, volumeBytes: 1_600_000 },
  {
    date: "2026-08-28",
    measurements: 120,
    cumulativeMeasurements: 1_000_000,
    volumeBytes: 2_400_000,
  },
];

const windows = {
  measurements24h: 140,
  measurements30d: 4_812,
  experiments30d: 23,
  contributors30d: 31,
  devices30d: 12,
  lastMeasurementAt: "2026-08-28 10:00:00",
  computedAt: "2026-08-28 10:05:00",
};

const poolFacts = {
  sessionMedianMeasurements: 45,
  meanArrivalGapSeconds: 538.65,
  currentStreakDays: 2,
  deviceEnduranceDays: 94,
  simultaneityPeakDevices: 14,
  timezonesAllTime: 14,
  timezonesPeakDay: 9,
};

describe("GetPublicMetricsUseCase", () => {
  const testApp = TestHarness.App;
  let adapter: DatabricksAdapter;
  let useCase: GetPublicMetricsUseCase;
  let totalsSpy: ReturnType<typeof vi.spyOn>;
  let experimentId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    vi.useFakeTimers({ now: new Date("2026-08-28T12:00:00Z"), toFake: ["Date"] });
    await testApp.beforeEach();

    // The snapshot key is shared, so each test starts from a cold cache.
    await testApp.module.get<CachePort>(CACHE_PORT).invalidate(PUBLIC_METRICS_CACHE_KEY);

    adapter = testApp.module.get(DatabricksAdapter);
    useCase = testApp.module.get(GetPublicMetricsUseCase);

    const userId = await testApp.createTestUser({});
    const organizationId = await testApp.createOrganization();
    await testApp.addOrganizationMember(organizationId, userId, "member");
    const { experiment } = await testApp.createExperiment({
      name: "Public experiment",
      userId,
      organizationId,
      visibility: "public",
    });
    experimentId = experiment.id;

    const collaboratorId = await testApp.createTestUser({ email: "metrics-collab@example.com" });
    await testApp.addResourceGrant({
      resourceType: "experiment",
      resourceId: experimentId,
      granteeType: "user",
      granteeId: collaboratorId,
      role: "viewer",
      createdBy: userId,
    });

    totalsSpy = vi.spyOn(adapter, "getPublicPlatformTotals").mockResolvedValue(success(totals));
    vi.spyOn(adapter, "getPublicDailyActivity").mockResolvedValue(success(daily));
    vi.spyOn(adapter, "getPublicFamilyTotals").mockResolvedValue(
      success([{ family: "multispeq", measurements: 900 }]),
    );
    vi.spyOn(adapter, "getActivityWindows").mockResolvedValue(success(windows));
    vi.spyOn(adapter, "getHourlyActivity").mockResolvedValue(
      success([{ hourLocal: 12, measurements: 300 }]),
    );
    vi.spyOn(adapter, "getTopParameter").mockImplementation((category) =>
      Promise.resolve(
        category === "derived"
          ? success({ name: "Phi2", count30d: 4214, median: 0.62 })
          : success({ name: "humidity", count30d: 4797, median: 42.85 }),
      ),
    );
    vi.spyOn(adapter, "getPoolFacts").mockResolvedValue(success(poolFacts));
    vi.spyOn(adapter, "getContributorPairs").mockResolvedValue(
      success([{ experimentId, userId: "contributor-1" }]),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("assembles the slot-shaped snapshot", async () => {
    const result = await useCase.execute();

    assertSuccess(result);
    expect(result.value.hero).toEqual({
      totalMeasurements: 1_000_000,
      totalVolumeBytes: 6_000_000,
      timezonesSpanned: 14,
    });
    expect(result.value.liveness).toEqual({
      lastMeasurementAt: "2026-08-28 10:00:00",
      measurements24h: 140,
    });
    expect(result.value.community?.measurements30d).toBe(4_812);
    expect(result.value.community?.institutions30d).toBe(1);
    expect(result.value.derivedParameter?.name).toBe("Phi2");
    expect(result.value.sensorParameter?.name).toBe("humidity");
    expect(result.value.families).toHaveLength(1);
    expect(result.value.hourly).toHaveLength(1);
  });

  it("derives streak, pace, milestone, and size captions", async () => {
    const result = await useCase.execute();

    assertSuccess(result);
    const kinds = new Map(result.value.captions.map((caption) => [caption.kind, caption]));

    // 2026-08-25 is not adjacent to 08-27, so the streak is the last two days.
    expect(kinds.get("streak")).toEqual({ kind: "streak", days: 2 });
    // The measured gap between measurements, straight from the pipeline.
    expect(kinds.get("pace")).toEqual({ kind: "pace", secondsPerMeasurement: 538.65 });
    expect(kinds.get("milestone")).toEqual({
      kind: "milestone",
      ordinal: 1_000_000,
      date: "2026-08-28",
    });
    // 6 MB over the 300 measurements the daily window holds.
    expect(kinds.get("avgMeasurementSize")).toEqual({
      kind: "avgMeasurementSize",
      bytes: 20_000,
    });
    expect(kinds.get("endurance")).toEqual({ kind: "endurance", days: 94 });
    expect(kinds.get("openDatasets")).toEqual({ kind: "openDatasets", count: 1 });
    expect(kinds.get("sharedExperiments")).toEqual({ kind: "sharedExperiments", count: 1 });
  });

  it("omits the pace and streak when there is no interval or run to report", async () => {
    // Timestamps sharing a millisecond leave no measurable gap; a zero here
    // would publish "a measurement arrives every 0 seconds".
    vi.spyOn(adapter, "getPoolFacts").mockResolvedValue(
      success({ ...poolFacts, meanArrivalGapSeconds: 0, currentStreakDays: 0 }),
    );

    const result = await useCase.execute();

    assertSuccess(result);
    const kinds = result.value.captions.map((caption) => caption.kind);
    expect(kinds).not.toContain("pace");
    expect(kinds).not.toContain("streak");
  });

  it("serves the cached snapshot without refetching", async () => {
    await useCase.execute();
    const result = await useCase.execute();

    assertSuccess(result);
    expect(totalsSpy).toHaveBeenCalledTimes(1);
  });

  it("hides the community slot when contributor inputs are unavailable", async () => {
    vi.spyOn(adapter, "getContributorPairs").mockResolvedValue(
      failure(AppError.internal("warehouse down")),
    );

    const result = await useCase.execute();

    assertSuccess(result);
    expect(result.value.community).toBeNull();
    expect(result.value.liveness).not.toBeNull();
  });

  it("serves an empty snapshot without caching it when the core reads fail", async () => {
    const warehouseDown = failure(AppError.internal("warehouse down"));
    totalsSpy = vi.spyOn(adapter, "getPublicPlatformTotals").mockResolvedValue(warehouseDown);
    vi.spyOn(adapter, "getActivityWindows").mockResolvedValue(warehouseDown);
    vi.spyOn(adapter, "getPublicDailyActivity").mockResolvedValue(warehouseDown);

    const first = await useCase.execute();
    const second = await useCase.execute();

    assertSuccess(first);
    expect(first.value.hero).toBeNull();
    expect(first.value.liveness).toBeNull();
    expect(first.value.activity).toEqual([]);
    expect(first.value.captions).toEqual([]);

    // The empty snapshot was not cached: the second request retried.
    assertSuccess(second);
    expect(totalsSpy).toHaveBeenCalledTimes(2);
  });

  it("hides the hero instead of inventing zeros when an input is missing", async () => {
    vi.spyOn(adapter, "getPoolFacts").mockResolvedValue(failure(AppError.internal("down")));

    const result = await useCase.execute();

    assertSuccess(result);
    expect(result.value.hero).toBeNull();
    expect(result.value.liveness).not.toBeNull();
  });

  it("emits no milestone below the first threshold", async () => {
    totalsSpy = vi
      .spyOn(adapter, "getPublicPlatformTotals")
      .mockResolvedValue(success({ ...totals, totalMeasurements: 500 }));

    const result = await useCase.execute();

    assertSuccess(result);
    const kinds = result.value.captions.map((caption) => caption.kind);
    expect(kinds).not.toContain("milestone");
  });

  it("hides the community slot when the institution lookup fails", async () => {
    const repository = testApp.module.get(MetricsRepository);
    vi.spyOn(repository, "getExperimentOrganizations").mockResolvedValue(
      failure(AppError.internal("database down")),
    );

    const result = await useCase.execute();

    assertSuccess(result);
    expect(result.value.community).toBeNull();
  });

  it("withholds the milestone when its crossing predates the fetched window", async () => {
    vi.spyOn(adapter, "getPublicDailyActivity").mockResolvedValue(
      success([
        {
          date: "2026-08-28",
          measurements: 120,
          cumulativeMeasurements: 1_500_000,
          volumeBytes: 2_400_000,
        },
      ]),
    );

    const result = await useCase.execute();

    assertSuccess(result);
    const kinds = result.value.captions.map((caption) => caption.kind);
    expect(kinds).not.toContain("milestone");
  });
});
