import { DatabricksAdapter } from "../../../../common/modules/databricks/databricks.adapter";
import { AppError, assertSuccess, failure, success } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { CACHE_PORT } from "../../../core/ports/cache.port";
import type { CachePort } from "../../../core/ports/cache.port";
import { GetResourceActivityUseCase, resourceActivityCacheKey } from "./get-resource-activity";

describe("GetResourceActivityUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: GetResourceActivityUseCase;
  let adapter: DatabricksAdapter;
  let ownerId: string;
  let outsiderId: string;
  let visibleProtocolId: string;
  let privateProtocolId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();

    adapter = testApp.module.get(DatabricksAdapter);
    useCase = testApp.module.get(GetResourceActivityUseCase);
    ownerId = await testApp.createTestUser({});
    outsiderId = await testApp.createTestUser({});

    const visible = await testApp.createProtocol({
      name: "Public protocol",
      createdBy: ownerId,
      visibility: "public",
    });
    visibleProtocolId = visible.id;

    const hidden = await testApp.createProtocol({
      name: "Private protocol",
      createdBy: outsiderId,
      visibility: "private",
    });
    privateProtocolId = hidden.id;

    vi.spyOn(adapter, "getResourceDailyActivity").mockResolvedValue(
      success([
        {
          date: "2026-08-27",
          resourceType: "protocol",
          resourceId: visibleProtocolId,
          measurements: 40,
        },
        {
          date: "2026-08-28",
          resourceType: "protocol",
          resourceId: visibleProtocolId,
          measurements: 62,
        },
        {
          date: "2026-08-28",
          resourceType: "protocol",
          resourceId: privateProtocolId,
          measurements: 999,
        },
      ]),
    );

    // The cached rows key on the previous test's resource ids, so the clear
    // has to follow the fixtures rather than precede them.
    await testApp.module
      .get<CachePort>(CACHE_PORT)
      .invalidate(resourceActivityCacheKey("protocol"));
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("returns a daily series per resource the caller may read", async () => {
    const result = await useCase.execute("protocol", ownerId);

    assertSuccess(result);
    const resource = result.value.resources.find((entry) => entry.id === visibleProtocolId);
    expect(resource?.measurements).toBe(102);
    expect(resource?.days).toEqual([
      { date: "2026-08-27", measurements: 40 },
      { date: "2026-08-28", measurements: 62 },
    ]);
  });

  it("omits resources the caller cannot read, and their measurements", async () => {
    const result = await useCase.execute("protocol", ownerId);

    assertSuccess(result);
    // A private protocol's activity would otherwise leak through the totals.
    expect(result.value.resources.map((entry) => entry.id)).not.toContain(privateProtocolId);
    expect(result.value.totalMeasurements).toBe(102);
    expect(result.value.activeCount).toBe(1);
  });

  it("degrades to empty strips when the warehouse is unavailable", async () => {
    vi.spyOn(adapter, "getResourceDailyActivity").mockResolvedValue(
      failure(AppError.internal("warehouse down")),
    );

    const result = await useCase.execute("protocol", ownerId);

    assertSuccess(result);
    expect(result.value.resources).toEqual([]);
    expect(result.value.totalMeasurements).toBe(0);
  });
});
