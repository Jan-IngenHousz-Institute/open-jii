import { DatabricksAdapter } from "../../../../common/modules/databricks/databricks.adapter";
import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { IOT_SERVING_STORE_PORT } from "../../../core/ports/serving-store.port";
import type { ServingStorePort } from "../../../core/ports/serving-store.port";
import { GetDeviceObservedExperimentsUseCase } from "./get-device-observed-experiments";

const FROM = "2026-07-26T00:00:00.000Z";
const TO = "2026-08-25T00:00:00.000Z";
const EXPERIMENT_A = "11111111-1111-4111-8111-111111111111";
const EXPERIMENT_B = "22222222-2222-4222-8222-222222222222";

describe("GetDeviceObservedExperimentsUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: GetDeviceObservedExperimentsUseCase;
  let databricksAdapter: DatabricksAdapter;
  let servingStore: ServingStorePort;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Observer" });
    useCase = testApp.module.get(GetDeviceObservedExperimentsUseCase);
    databricksAdapter = testApp.module.get(DatabricksAdapter);
    servingStore = testApp.module.get(IOT_SERVING_STORE_PORT);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("folds day buckets into per-experiment totals with the newest arrival day", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });
    const spy = vi.spyOn(databricksAdapter, "getDeviceThroughput").mockResolvedValue(
      success([
        { bucketStart: "2026-08-20T00:00:00.000Z", experimentId: EXPERIMENT_A, count: 5 },
        { bucketStart: "2026-08-22T00:00:00.000Z", experimentId: EXPERIMENT_A, count: 2 },
        { bucketStart: "2026-08-21T00:00:00.000Z", experimentId: EXPERIMENT_B, count: 9 },
        // Rows the pipeline could not attribute stay their own honest bucket.
        { bucketStart: "2026-08-19T00:00:00.000Z", experimentId: null, count: 3 },
      ]),
    );

    const result = await useCase.execute(device.id, FROM, TO, "warehouse");

    assertSuccess(result);
    expect(result.value).toEqual([
      { experimentId: EXPERIMENT_B, count: 9, lastAt: "2026-08-21T00:00:00.000Z" },
      { experimentId: EXPERIMENT_A, count: 7, lastAt: "2026-08-22T00:00:00.000Z" },
      { experimentId: null, count: 3, lastAt: "2026-08-19T00:00:00.000Z" },
    ]);
    expect(spy).toHaveBeenCalledWith(device.thingName, FROM, TO, "day");
  });

  it("answers an empty window as an empty list", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });
    vi.spyOn(databricksAdapter, "getDeviceThroughput").mockResolvedValue(success([]));

    const result = await useCase.execute(device.id, FROM, TO, "warehouse");

    assertSuccess(result);
    expect(result.value).toEqual([]);
  });

  it("fails on an unknown device before touching the warehouse", async () => {
    const spy = vi.spyOn(databricksAdapter, "getDeviceThroughput");

    const result = await useCase.execute(
      "99999999-9999-4999-8999-999999999999",
      FROM,
      TO,
      "warehouse",
    );

    assertFailure(result);
    expect(spy).not.toHaveBeenCalled();
  });

  it("propagates a warehouse failure loudly, the card owns the error state", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });
    vi.spyOn(databricksAdapter, "getDeviceThroughput").mockResolvedValue(
      failure(AppError.internal("warehouse down")),
    );

    const result = await useCase.execute(device.id, FROM, TO, "warehouse");

    assertFailure(result);
  });

  it("answers the same from the store as from the warehouse", async () => {
    const device = await testApp.createIotDevice({ createdBy: userId });
    const rows = [
      { bucketStart: "2026-08-20T00:00:00.000Z", experimentId: EXPERIMENT_A, count: 5 },
      { bucketStart: "2026-08-21T00:00:00.000Z", experimentId: EXPERIMENT_B, count: 9 },
    ];
    const warehouse = vi
      .spyOn(databricksAdapter, "getDeviceThroughput")
      .mockResolvedValue(success(rows));
    const store = vi.spyOn(servingStore, "getDeviceThroughput").mockResolvedValue(success(rows));

    const fromWarehouse = await useCase.execute(device.id, FROM, TO, "warehouse");
    const fromStore = await useCase.execute(device.id, FROM, TO, "store");

    assertSuccess(fromWarehouse);
    assertSuccess(fromStore);
    expect(fromStore.value).toEqual(fromWarehouse.value);
    expect(warehouse).toHaveBeenCalledOnce();
    expect(store).toHaveBeenCalledOnce();
    expect(store).toHaveBeenCalledWith(device.thingName, FROM, TO, "day");
  });

  it("reads nothing from the store for a device that does not exist", async () => {
    const store = vi.spyOn(servingStore, "getDeviceThroughput");

    const result = await useCase.execute("99999999-9999-4999-8999-999999999999", FROM, TO, "store");

    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
    expect(store).not.toHaveBeenCalled();
  });
});
