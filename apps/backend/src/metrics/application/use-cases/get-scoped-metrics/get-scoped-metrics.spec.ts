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
import { MetricsRepository } from "../../../core/repositories/metrics.repository";
import { GetScopedMetricsUseCase, SCOPED_INPUTS_CACHE_KEY } from "./get-scoped-metrics";

// The window slides, so fixtures are anchored to today rather than to dates
// that would drift out of range.
const dayAt = (offset: number) =>
  new Date(Date.now() - offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

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

    await testApp.module.get<CachePort>(CACHE_PORT).invalidate(SCOPED_INPUTS_CACHE_KEY);

    vi.spyOn(adapter, "getActivityWindows").mockResolvedValue(success(windows));
    vi.spyOn(adapter, "getScopedDailyActivity").mockResolvedValue(
      success([
        { date: dayAt(2), experimentId: orgExperimentId, measurements: 700 },
        { date: dayAt(1), experimentId: orgExperimentId, measurements: 300 },
        { date: dayAt(1), experimentId: "someone-elses-experiment", measurements: 999 },
        // The window before this one, which the response reports separately.
        { date: dayAt(40), experimentId: orgExperimentId, measurements: 250 },
      ]),
    );
    vi.spyOn(adapter, "getContributorPairs").mockResolvedValue(
      success([
        { experimentId: orgExperimentId, userId: "contributor-1" },
        { experimentId: orgExperimentId, userId: "contributor-2" },
        { experimentId: "someone-elses-experiment", userId: "contributor-3" },
      ]),
    );
    vi.spyOn(adapter, "getDevicePairs").mockResolvedValue(
      success([
        { experimentId: orgExperimentId, clientId: "logger-1" },
        { experimentId: orgExperimentId, clientId: "logger-2" },
        { experimentId: "someone-elses-experiment", clientId: "logger-3" },
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
    expect(result.value.scoped?.measurements30d).toBe(1_000);
    expect(result.value.scoped?.activeExperiments30d).toBe(1);
    expect(result.value.scoped?.contributors30d).toBe(2);
    // Two loggers reported here; the third belongs to an experiment out of scope.
    expect(result.value.scoped?.devices30d).toBe(2);
    expect(result.value.scoped?.previousMeasurements).toBe(250);
    expect(result.value.scoped?.activeDays).toBe(2);
    expect(result.value.scoped?.peak).toEqual({ date: dayAt(2), measurements: 700 });
    expect(result.value.scoped?.lastActivityDate).toBe(dayAt(1));
    expect(result.value.baseline?.measurements30d).toBe(4_000);
  });

  it("draws the window dense so a silent day is a zero rather than a gap", async () => {
    const result = await useCase.execute("organization", userId, organizationId);

    assertSuccess(result);
    expect(result.value.scoped?.activity).toHaveLength(30);
    expect(result.value.scoped?.activity.filter((day) => day.measurements > 0)).toEqual([
      { date: dayAt(2), measurements: 700 },
      { date: dayAt(1), measurements: 300 },
    ]);
  });

  it("keeps every other figure when only the device table is unavailable", async () => {
    vi.spyOn(adapter, "getDevicePairs").mockResolvedValue(
      failure(AppError.internal("table not found")),
    );

    const result = await useCase.execute("organization", userId, organizationId);

    assertSuccess(result);
    // Unknown, not none: the band still states what it does know.
    expect(result.value.scoped?.devices30d).toBeNull();
    expect(result.value.scoped?.measurements30d).toBe(1_000);
    expect(result.value.scoped?.contributors30d).toBe(2);
  });

  it("degrades to empty slots, uncached, when a warehouse read fails", async () => {
    const pairsSpy = vi
      .spyOn(adapter, "getContributorPairs")
      .mockResolvedValue(failure(AppError.internal("warehouse down")));

    const first = await useCase.execute("mine", userId);
    const second = await useCase.execute("mine", userId);

    assertSuccess(first);
    expect(first.value.scoped).toBeNull();
    expect(first.value.baseline).toBeNull();

    // Nothing was cached, so the second request retried the warehouse.
    assertSuccess(second);
    expect(pairsSpy).toHaveBeenCalledTimes(2);
  });

  it("counts experiments the user joined through a grant in mine scope", async () => {
    const { experiment: joined } = await testApp.createExperiment({
      name: "Joined experiment",
      userId: outsiderId,
      organizationId,
    });
    await testApp.addResourceGrant({
      resourceType: "experiment",
      resourceId: joined.id,
      granteeType: "user",
      granteeId: userId,
      role: "viewer",
      createdBy: outsiderId,
    });
    vi.spyOn(adapter, "getScopedDailyActivity").mockResolvedValue(
      success([
        { date: dayAt(1), experimentId: orgExperimentId, measurements: 300 },
        { date: dayAt(1), experimentId: joined.id, measurements: 42 },
      ]),
    );

    const result = await useCase.execute("mine", userId);

    assertSuccess(result);
    expect(result.value.scoped?.measurements30d).toBe(342);
    expect(result.value.scoped?.activeExperiments30d).toBe(2);
  });

  it("propagates a failed membership lookup", async () => {
    const repository = testApp.module.get(MetricsRepository);
    vi.spyOn(repository, "isOrganizationMember").mockResolvedValue(
      failure(AppError.internal("database down")),
    );

    const result = await useCase.execute("organization", userId, organizationId);

    assertFailure(result);
  });

  it("propagates a failed experiment-id lookup", async () => {
    const repository = testApp.module.get(MetricsRepository);
    vi.spyOn(repository, "getUserExperimentIds").mockResolvedValue(
      failure(AppError.internal("database down")),
    );

    const result = await useCase.execute("mine", userId);

    assertFailure(result);
  });

  it("scopes to a single experiment the caller may read", async () => {
    const result = await useCase.execute("experiment", userId, undefined, orgExperimentId);

    assertSuccess(result);
    expect(result.value.scoped?.measurements30d).toBe(1_000);
    expect(result.value.scoped?.activeExperiments30d).toBe(1);
    expect(result.value.scoped?.contributors30d).toBe(2);
  });

  it("denies experiment scope to a user without read access", async () => {
    const result = await useCase.execute("experiment", outsiderId, undefined, orgExperimentId);

    assertFailure(result);
    expect(result.error.code).toBe("FORBIDDEN");
  });

  it("requires an experimentId for experiment scope", async () => {
    const result = await useCase.execute("experiment", userId);

    assertFailure(result);
    expect(result.error.code).toBe("BAD_REQUEST");
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
    expect(result.value.scoped?.measurements30d).toBe(1_000);
  });

  it("returns an empty mine scope for a user with no experiments", async () => {
    const result = await useCase.execute("mine", outsiderId);

    assertSuccess(result);
    expect(result.value.scoped?.measurements30d).toBe(0);
    expect(result.value.scoped?.activity.every((day) => day.measurements === 0)).toBe(true);
    expect(result.value.scoped?.activeDays).toBe(0);
    expect(result.value.scoped?.peak).toBeNull();
    expect(result.value.scoped?.lastActivityDate).toBeNull();
  });
});
