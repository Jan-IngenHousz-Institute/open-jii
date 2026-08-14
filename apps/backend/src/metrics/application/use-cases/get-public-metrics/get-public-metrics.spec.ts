import type {
  PublicDailyActivity,
  PublicFamilyTotals,
  PublicPlatformTotals,
  PublicRegistryCounts,
} from "@repo/api/domains/metrics/metrics.schema";

import { DatabricksAdapter } from "../../../../common/modules/databricks/databricks.adapter";
import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { MetricsRepository } from "../../../core/repositories/metrics.repository";
import { GetPublicMetricsUseCase } from "./get-public-metrics";

const registry: PublicRegistryCounts = {
  registeredUsers: 12,
  organizations: 3,
  experiments: 7,
  protocols: 4,
  macros: 2,
};

const totals: PublicPlatformTotals = {
  totalMeasurements: 1000,
  totalUploadedRows: 50,
  totalMacroExecutions: 200,
  devicesAllTime: 9,
  experimentsWithData: 5,
  firstMeasurementAt: "2024-01-01 00:00:00",
  lastMeasurementAt: "2026-08-14 10:00:00",
  computedAt: "2026-08-14 10:05:00",
};

const daily: PublicDailyActivity[] = [
  {
    date: "2026-08-14",
    measurements: 10,
    liveMeasurements: 8,
    importedMeasurements: 2,
    activeDevices: 3,
    activeExperiments: 2,
    macroExecutions: 4,
    uploadedRows: 0,
    cumulativeMeasurements: 1000,
  },
];

const families: PublicFamilyTotals[] = [
  {
    family: "multispeq",
    totalMeasurements: 900,
    devicesAllTime: 7,
    devicesActive7d: 3,
    lastMeasurementAt: "2026-08-14 10:00:00",
  },
];

describe("GetPublicMetricsUseCase", () => {
  const testApp = TestHarness.App;
  let adapter: DatabricksAdapter;
  let repository: MetricsRepository;
  let useCase: GetPublicMetricsUseCase;
  let totalsSpy: ReturnType<typeof vi.spyOn>;
  let registrySpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    vi.useFakeTimers();

    adapter = testApp.module.get(DatabricksAdapter);
    repository = testApp.module.get(MetricsRepository);

    totalsSpy = vi.spyOn(adapter, "getPublicPlatformTotals").mockResolvedValue(success(totals));
    vi.spyOn(adapter, "getPublicDailyActivity").mockResolvedValue(success(daily));
    vi.spyOn(adapter, "getPublicFamilyTotals").mockResolvedValue(success(families));
    registrySpy = vi.spyOn(repository, "getRegistryCounts").mockResolvedValue(success(registry));

    // Fresh instance per test: the snapshot cache is instance state and the
    // module-level singleton would leak it across tests.
    useCase = new GetPublicMetricsUseCase(adapter, repository);
  });

  afterEach(() => {
    vi.useRealTimers();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("returns the combined snapshot", async () => {
    const result = await useCase.execute();

    assertSuccess(result);
    expect(result.value).toEqual({
      registry,
      totals,
      dailyActivity: daily,
      familyTotals: families,
    });
  });

  it("serves the cached snapshot within the TTL without refetching", async () => {
    await useCase.execute();
    vi.advanceTimersByTime(60 * 1000);
    const result = await useCase.execute();

    assertSuccess(result);
    expect(totalsSpy).toHaveBeenCalledTimes(1);
    expect(registrySpy).toHaveBeenCalledTimes(1);
  });

  it("refetches once the TTL has expired", async () => {
    await useCase.execute();
    vi.advanceTimersByTime(11 * 60 * 1000);
    await useCase.execute();

    expect(totalsSpy).toHaveBeenCalledTimes(2);
  });

  it("degrades to registry counts when the warehouse is unavailable", async () => {
    const warehouseDown = failure(AppError.internal("warehouse down"));
    vi.spyOn(adapter, "getPublicPlatformTotals").mockResolvedValue(warehouseDown);
    vi.spyOn(adapter, "getPublicDailyActivity").mockResolvedValue(warehouseDown);
    vi.spyOn(adapter, "getPublicFamilyTotals").mockResolvedValue(warehouseDown);

    const result = await useCase.execute();

    assertSuccess(result);
    expect(result.value).toEqual({
      registry,
      totals: null,
      dailyActivity: [],
      familyTotals: [],
    });
  });

  it("serves the stale snapshot when a refresh fails", async () => {
    await useCase.execute();
    vi.advanceTimersByTime(11 * 60 * 1000);

    vi.spyOn(repository, "getRegistryCounts").mockResolvedValue(
      failure(AppError.internal("postgres down")),
    );

    const result = await useCase.execute();

    assertSuccess(result);
    expect(result.value.registry).toEqual(registry);
  });

  it("fails when there is no snapshot and the registry counts fail", async () => {
    vi.spyOn(repository, "getRegistryCounts").mockResolvedValue(
      failure(AppError.internal("postgres down")),
    );

    const result = await useCase.execute();

    assertFailure(result);
  });
});
