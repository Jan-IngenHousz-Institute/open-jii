import { DatabricksAdapter } from "../../../../common/modules/databricks/databricks.adapter";
import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { CACHE_PORT } from "../../../core/ports/cache.port";
import type { CachePort } from "../../../core/ports/cache.port";
import { GetScopedMetricsUseCase } from "./get-scoped-metrics";

const windows = {
  measurements24h: 140,
  measurements30d: 4_000,
  experiments30d: 23,
  contributors30d: 31,
  devices30d: 12,
  lastMeasurementAt: "2026-08-28 10:00:00",
  computedAt: "2026-08-28 10:05:00",
};

describe("GetScopedMetricsUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: GetScopedMetricsUseCase;
  let adapter: DatabricksAdapter;
  let userId: string;
  let outsiderId: string;
  let organizationId: string;
  let orgExperimentId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();

    adapter = testApp.module.get(DatabricksAdapter);
    useCase = testApp.module.get(GetScopedMetricsUseCase);

    userId = await testApp.createTestUser({});
    outsiderId = await testApp.createTestUser({});
    organizationId = await testApp.createOrganization();
    await testApp.addOrganizationMember(organizationId, userId, "member");

    const { experiment } = await testApp.createExperiment({
      name: "Org experiment",
      userId,
      organizationId,
    });
    orgExperimentId = experiment.id;

    const cache = testApp.module.get<CachePort>(CACHE_PORT);
    await cache.invalidate(`scoped-org-${organizationId}`);
    await cache.invalidate(`scoped-user-${userId}`);

    vi.spyOn(adapter, "getActivityWindows").mockResolvedValue(success(windows));
    vi.spyOn(adapter, "getScopedDailyActivity").mockResolvedValue(
      success([
        { date: "2026-08-27", experimentId: orgExperimentId, measurements: 700 },
        { date: "2026-08-28", experimentId: orgExperimentId, measurements: 300 },
        { date: "2026-08-28", experimentId: "someone-elses-experiment", measurements: 999 },
      ]),
    );
    vi.spyOn(adapter, "getContributorPairs").mockResolvedValue(
      success([
        { experimentId: orgExperimentId, userId: "contributor-1" },
        { experimentId: orgExperimentId, userId: "contributor-2" },
        { experimentId: "someone-elses-experiment", userId: "contributor-3" },
      ]),
    );
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("aggregates the organization's experiments against the platform baseline", async () => {
    const result = await useCase.execute("organization", userId, organizationId);

    assertSuccess(result);
    expect(result.value.scoped.measurements30d).toBe(1_000);
    expect(result.value.scoped.activeExperiments30d).toBe(1);
    expect(result.value.scoped.contributors30d).toBe(2);
    expect(result.value.scoped.activity).toEqual([
      { date: "2026-08-27", measurements: 700 },
      { date: "2026-08-28", measurements: 300 },
    ]);
    expect(result.value.scoped.lastMeasurementAt).toBe("2026-08-28");
    expect(result.value.baseline.measurements30d).toBe(4_000);
  });

  it("fails instead of serving zero contributors when the contributor read fails", async () => {
    vi.spyOn(adapter, "getContributorPairs").mockResolvedValue(
      failure(AppError.internal("warehouse down")),
    );

    const result = await useCase.execute("mine", userId);

    assertFailure(result);
  });

  it("denies organization scope to non-members", async () => {
    const result = await useCase.execute("organization", outsiderId, organizationId);

    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
  });

  it("requires an organizationId for organization scope", async () => {
    const result = await useCase.execute("organization", userId);

    assertFailure(result);
  });

  it("scopes to the user's created experiments for mine", async () => {
    const result = await useCase.execute("mine", userId);

    assertSuccess(result);
    expect(result.value.scoped.measurements30d).toBe(1_000);
  });

  it("returns an empty mine scope for a user with no experiments", async () => {
    const result = await useCase.execute("mine", outsiderId);

    assertSuccess(result);
    expect(result.value.scoped.measurements30d).toBe(0);
    expect(result.value.scoped.activity).toEqual([]);
    expect(result.value.scoped.lastMeasurementAt).toBeNull();
  });
});
