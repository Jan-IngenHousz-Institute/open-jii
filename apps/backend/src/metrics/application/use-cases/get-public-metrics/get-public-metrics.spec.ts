import { DatabricksAdapter } from "../../../../common/modules/databricks/databricks.adapter";
import { AppError, assertSuccess, failure, success } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { CACHE_PORT } from "../../../core/ports/cache.port";
import type { CachePort } from "../../../core/ports/cache.port";
import { GetPublicMetricsUseCase, PUBLIC_METRICS_CACHE_KEY } from "./get-public-metrics";

const totals = {
  totalMeasurements: 1_000_000,
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

    totalsSpy = vi.spyOn(adapter, "getPublicPlatformTotals").mockResolvedValue(success(totals));
    vi.spyOn(adapter, "getPublicTotalVolumeBytes").mockResolvedValue(success(6_000_000));
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
    vi.spyOn(adapter, "getContributorPairs").mockResolvedValue(success([]));
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
    expect(kinds.get("pace")).toEqual({
      kind: "pace",
      secondsPerMeasurement: Math.round((30 * 24 * 3600) / 4_812),
    });
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
    vi.spyOn(adapter, "getPublicTotalVolumeBytes").mockResolvedValue(
      failure(AppError.internal("warehouse down")),
    );

    const result = await useCase.execute();

    assertSuccess(result);
    expect(result.value.hero).toBeNull();
    expect(result.value.liveness).not.toBeNull();
  });

  it("withholds the streak once the newest daily row is stale", async () => {
    vi.useFakeTimers({ now: new Date("2026-09-10T12:00:00Z"), toFake: ["Date"] });

    const result = await useCase.execute();

    assertSuccess(result);
    const kinds = result.value.captions.map((caption) => caption.kind);
    expect(kinds).not.toContain("streak");
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
