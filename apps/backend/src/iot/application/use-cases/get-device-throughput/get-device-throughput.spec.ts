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
import { GetDeviceThroughputUseCase } from "./get-device-throughput";

const THING = "AMBYTE_A";
const FROM = "2026-08-13T00:00:00.000Z";
const TO = "2026-08-13T12:00:00.000Z";
const EXPERIMENT = "22222222-2222-4222-8222-222222222222";

describe("GetDeviceThroughputUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: GetDeviceThroughputUseCase;
  let databricksAdapter: DatabricksAdapter;
  let servingStore: ServingStorePort;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    useCase = testApp.module.get(GetDeviceThroughputUseCase);
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

  it("returns the warehouse buckets and forwards the requested bucket size", async () => {
    const getThroughput = vi
      .spyOn(databricksAdapter, "getDeviceThroughput")
      .mockResolvedValue(
        success([{ bucketStart: "2026-08-13T01:00:00.000Z", experimentId: EXPERIMENT, count: 12 }]),
      );

    const result = await useCase.execute(THING, FROM, TO, "hour", "warehouse");

    assertSuccess(result);
    expect(result.value).toEqual([
      { bucketStart: "2026-08-13T01:00:00.000Z", experimentId: EXPERIMENT, count: 12 },
    ]);
    expect(getThroughput).toHaveBeenCalledWith(THING, FROM, TO, "hour");
  });

  it("drops rows whose bucket start did not parse, keeping the output contract-clean", async () => {
    vi.spyOn(databricksAdapter, "getDeviceThroughput").mockResolvedValue(
      success([
        { bucketStart: null, experimentId: EXPERIMENT, count: 3 },
        { bucketStart: "2026-08-13T02:00:00.000Z", experimentId: null, count: 5 },
      ]),
    );

    const result = await useCase.execute(THING, FROM, TO, "hour", "warehouse");

    assertSuccess(result);
    expect(result.value).toEqual([
      { bucketStart: "2026-08-13T02:00:00.000Z", experimentId: null, count: 5 },
    ]);
  });

  it("propagates a warehouse failure", async () => {
    vi.spyOn(databricksAdapter, "getDeviceThroughput").mockResolvedValue(
      failure(AppError.internal("warehouse down")),
    );

    const result = await useCase.execute(THING, FROM, TO, "day", "warehouse");

    assertFailure(result);
  });

  it("reads the store, not the warehouse, when the source is the store", async () => {
    const rows = [
      { bucketStart: "2026-08-13T01:00:00.000Z", experimentId: EXPERIMENT, count: 12 },
      { bucketStart: null, experimentId: EXPERIMENT, count: 3 },
    ];
    const warehouse = vi
      .spyOn(databricksAdapter, "getDeviceThroughput")
      .mockResolvedValue(success(rows));
    const store = vi.spyOn(servingStore, "getDeviceThroughput").mockResolvedValue(success(rows));

    const fromWarehouse = await useCase.execute(THING, FROM, TO, "hour", "warehouse");
    const fromStore = await useCase.execute(THING, FROM, TO, "hour", "store");

    assertSuccess(fromWarehouse);
    assertSuccess(fromStore);
    expect(fromStore.value).toEqual(fromWarehouse.value);
    expect(warehouse).toHaveBeenCalledOnce();
    expect(store).toHaveBeenCalledOnce();
    expect(store).toHaveBeenCalledWith(THING, FROM, TO, "hour");
  });
});
