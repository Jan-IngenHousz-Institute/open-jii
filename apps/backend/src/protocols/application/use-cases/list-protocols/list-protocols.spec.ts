import { DatabricksAdapter } from "../../../../common/modules/databricks/databricks.adapter";
import { assertFailure, assertSuccess, failure, success } from "../../../../common/utils/fp-utils";
import { resourceMetricsCacheKey } from "../../../../metrics/application/resource-metrics.service";
import { CACHE_PORT } from "../../../../metrics/core/ports/cache.port";
import type { CachePort } from "../../../../metrics/core/ports/cache.port";
import { TestHarness } from "../../../../test/test-harness";
import { ProtocolRepository } from "../../../core/repositories/protocol.repository";
import { ListProtocolsUseCase } from "./list-protocols";

describe("ListProtocolsUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: ListProtocolsUseCase;
  let protocolRepository: ProtocolRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(ListProtocolsUseCase);
    protocolRepository = testApp.module.get(ProtocolRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should list all protocols without filter", async () => {
    // Arrange
    const protocol1 = {
      name: "Protocol 1",
      description: "Description 1",
      code: [{ steps: [{ name: "Step 1", action: "test" }] }],
      family: "multispeq" as const,
    };

    const protocol2 = {
      name: "Protocol 2",
      description: "Description 2",
      code: [{ steps: [{ name: "Step 2", action: "test" }] }],
      family: "multispeq" as const,
    };

    // Create test protocols
    await protocolRepository.create(protocol1, testUserId);
    await protocolRepository.create(protocol2, testUserId);

    // Act
    const result = await useCase.execute();

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const protocols = result.value;

    // Should find at least the two protocols we created
    expect(protocols.length).toBeGreaterThanOrEqual(2);
    expect(protocols.some((p) => p.name === protocol1.name)).toBe(true);
    expect(protocols.some((p) => p.name === protocol2.name)).toBe(true);
  });

  it("should filter protocols by search term", async () => {
    // Arrange
    const uniquePrefix = "UniqueTest";
    const protocol1 = {
      name: `${uniquePrefix} Protocol 1`,
      description: "Description 1",
      code: [{ steps: [{ name: "Step 1", action: "test" }] }],
      family: "multispeq" as const,
    };

    const protocol2 = {
      name: "Different Protocol 2",
      description: "Description 2",
      code: [{ steps: [{ name: "Step 2", action: "test" }] }],
      family: "multispeq" as const,
    };

    // Create test protocols
    await protocolRepository.create(protocol1, testUserId);
    await protocolRepository.create(protocol2, testUserId);

    // Act
    const result = await useCase.execute(uniquePrefix);

    // Assert
    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);
    const protocols = result.value;

    // Should only find the protocol with the unique prefix
    expect(protocols.some((p) => p.name === protocol1.name)).toBe(true);
    expect(protocols.every((p) => p.name !== protocol2.name)).toBe(true);
  });

  it("forwards an explicit sort to both listings", async () => {
    const sort = [{ field: "macros", direction: "desc" }] as const;
    const findAll = vi.spyOn(protocolRepository, "findAll");
    const findPage = vi.spyOn(protocolRepository, "findPage");

    assertSuccess(await useCase.execute(undefined, "all", testUserId, [...sort]));
    assertSuccess(await useCase.executePaginated(1, 10, undefined, "all", testUserId, [...sort]));

    expect(findAll).toHaveBeenCalledWith(
      undefined,
      "all",
      testUserId,
      undefined,
      undefined,
      [...sort],
      undefined,
      undefined,
    );
    expect(findPage).toHaveBeenCalledWith(
      1,
      10,
      undefined,
      "all",
      testUserId,
      undefined,
      [...sort],
      undefined,
      undefined,
    );
  });

  it("forwards the family and visibility filter to both listings", async () => {
    const filter = { families: ["ambyte" as const], visibilities: ["private" as const] };
    const findAll = vi.spyOn(protocolRepository, "findAll");
    const findPage = vi.spyOn(protocolRepository, "findPage");

    assertSuccess(await useCase.execute(undefined, "all", testUserId, undefined, filter));
    assertSuccess(
      await useCase.executePaginated(1, 10, undefined, "all", testUserId, undefined, filter),
    );

    expect(findAll).toHaveBeenCalledWith(
      undefined,
      "all",
      testUserId,
      undefined,
      undefined,
      undefined,
      filter,
      undefined,
    );
    expect(findPage).toHaveBeenCalledWith(
      1,
      10,
      undefined,
      "all",
      testUserId,
      undefined,
      undefined,
      filter,
      undefined,
    );
  });

  it("should handle repository failures", async () => {
    // Arrange
    // Mock repository to fail
    vi.spyOn(protocolRepository, "findAll").mockResolvedValue(
      failure({
        name: "RepositoryError",
        code: "INTERNAL_ERROR",
        message: "Repository error",
        statusCode: 500,
      }),
    );

    // Act
    const result = await useCase.execute();

    // Assert
    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error).toMatchObject({
      name: "RepositoryError",
      code: "INTERNAL_ERROR",
      message: "Repository error",
      statusCode: 500,
    });
  });

  describe("activity snapshot fallback", () => {
    async function makeWarehouseUnavailable() {
      const adapter = testApp.module.get(DatabricksAdapter);
      vi.spyOn(adapter, "getResourceDailyActivity").mockResolvedValue(
        failure({
          name: "AppError",
          code: "INTERNAL_ERROR",
          message: "warehouse down",
          statusCode: 500,
        }),
      );
      await testApp.module
        .get<CachePort>(CACHE_PORT)
        .invalidate(resourceMetricsCacheKey("protocol"));
    }

    it("falls back to the default order and reports unavailable when sorting by activity with no snapshot", async () => {
      await makeWarehouseUnavailable();
      // Created out of alphabetical order, so a name-order result proves the
      // repository's real default ordering ran rather than insertion order.
      const charlie = await protocolRepository.create(
        { name: "Charlie", description: "", code: [], family: "multispeq" },
        testUserId,
      );
      const alpha = await protocolRepository.create(
        { name: "Alpha", description: "", code: [], family: "multispeq" },
        testUserId,
      );
      const bravo = await protocolRepository.create(
        { name: "Bravo", description: "", code: [], family: "multispeq" },
        testUserId,
      );
      assertSuccess(charlie);
      assertSuccess(alpha);
      assertSuccess(bravo);

      const result = await useCase.executePaginated(1, 20, undefined, "all", testUserId, [
        { field: "activity", direction: "desc" },
      ]);

      assertSuccess(result);
      expect(result.value.activityAvailable).toBe(false);
      expect(result.value.items.map((item) => item.id)).toEqual([
        alpha.value[0].id,
        bravo.value[0].id,
        charlie.value[0].id,
      ]);
    });

    it("falls back to the remaining field when activity is paired with name and there is no snapshot", async () => {
      await makeWarehouseUnavailable();
      const alpha = await protocolRepository.create(
        { name: "Alpha", description: "", code: [], family: "multispeq" },
        testUserId,
      );
      const bravo = await protocolRepository.create(
        { name: "Bravo", description: "", code: [], family: "multispeq" },
        testUserId,
      );
      assertSuccess(alpha);
      assertSuccess(bravo);

      const result = await useCase.executePaginated(1, 20, undefined, "all", testUserId, [
        { field: "activity", direction: "desc" },
        { field: "name", direction: "asc" },
      ]);

      assertSuccess(result);
      expect(result.value.activityAvailable).toBe(false);
      expect(result.value.items.map((item) => item.name)).toEqual(["Alpha", "Bravo"]);
    });

    it("orders items consistently with the activity measurements it reports", async () => {
      const busy = await protocolRepository.create(
        { name: "Busy protocol", description: "", code: [], family: "multispeq" },
        testUserId,
      );
      const quiet = await protocolRepository.create(
        { name: "Quiet protocol", description: "", code: [], family: "multispeq" },
        testUserId,
      );
      assertSuccess(busy);
      assertSuccess(quiet);
      const busyId = busy.value[0].id;
      const quietId = quiet.value[0].id;

      const adapter = testApp.module.get(DatabricksAdapter);
      const today = new Date().toISOString().slice(0, 10);
      vi.spyOn(adapter, "getResourceDailyActivity").mockResolvedValue(
        success([
          { date: today, resourceType: "protocol", resourceId: busyId, measurements: 9 },
          { date: today, resourceType: "protocol", resourceId: quietId, measurements: 1 },
        ]),
      );
      await testApp.module
        .get<CachePort>(CACHE_PORT)
        .invalidate(resourceMetricsCacheKey("protocol"));

      const result = await useCase.executePaginated(1, 20, undefined, "all", testUserId, [
        { field: "activity", direction: "desc" },
      ]);

      assertSuccess(result);
      expect(result.value.activityAvailable).toBe(true);
      const ids = result.value.items.map((item) => item.id);
      expect(ids.indexOf(busyId)).toBeLessThan(ids.indexOf(quietId));
      const busyItem = result.value.items.find((item) => item.id === busyId);
      const quietItem = result.value.items.find((item) => item.id === quietId);
      expect(busyItem?.activity?.measurements).toBe(9);
      expect(quietItem?.activity?.measurements).toBe(1);
    });

    it("array path (execute): sorts by activity when a snapshot is available", async () => {
      const busy = await protocolRepository.create(
        { name: "Busy protocol", description: "", code: [], family: "multispeq" },
        testUserId,
      );
      const quiet = await protocolRepository.create(
        { name: "Quiet protocol", description: "", code: [], family: "multispeq" },
        testUserId,
      );
      assertSuccess(busy);
      assertSuccess(quiet);
      const busyId = busy.value[0].id;
      const quietId = quiet.value[0].id;

      const adapter = testApp.module.get(DatabricksAdapter);
      const today = new Date().toISOString().slice(0, 10);
      vi.spyOn(adapter, "getResourceDailyActivity").mockResolvedValue(
        success([
          { date: today, resourceType: "protocol", resourceId: busyId, measurements: 9 },
          { date: today, resourceType: "protocol", resourceId: quietId, measurements: 1 },
        ]),
      );
      await testApp.module
        .get<CachePort>(CACHE_PORT)
        .invalidate(resourceMetricsCacheKey("protocol"));

      const result = await useCase.execute(undefined, "all", testUserId, [
        { field: "activity", direction: "desc" },
      ]);

      assertSuccess(result);
      const ids = result.value.map((item) => item.id);
      expect(ids.indexOf(busyId)).toBeLessThan(ids.indexOf(quietId));
    });

    it("array path (execute): drops the activity criterion silently when there is no snapshot", async () => {
      await makeWarehouseUnavailable();
      // Out of alphabetical order, so name-order output proves the default
      // ordering ran rather than the activity criterion being honoured by luck.
      const charlie = await protocolRepository.create(
        { name: "Charlie", description: "", code: [], family: "multispeq" },
        testUserId,
      );
      const alpha = await protocolRepository.create(
        { name: "Alpha", description: "", code: [], family: "multispeq" },
        testUserId,
      );
      assertSuccess(charlie);
      assertSuccess(alpha);

      const result = await useCase.execute(undefined, "all", testUserId, [
        { field: "activity", direction: "desc" },
      ]);

      assertSuccess(result);
      expect(result.value.map((item) => item.id)).toEqual([alpha.value[0].id, charlie.value[0].id]);
    });
  });
});
