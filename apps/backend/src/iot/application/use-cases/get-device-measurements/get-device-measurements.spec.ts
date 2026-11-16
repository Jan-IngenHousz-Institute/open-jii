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
import { GetDeviceMeasurementsUseCase } from "./get-device-measurements";

const THING = "AMBYTE_A";
const FROM = "2026-08-13T00:00:00.000Z";
const TO = "2026-08-13T12:00:00.000Z";

function row(timestamp: string | null) {
  return {
    timestamp,
    experimentId: "exp-1",
    protocolId: "proto-1",
    workbookVersionId: null,
    deviceVersion: "1.1.0",
    battery: 4.16,
    latitude: null,
    longitude: null,
    sample: null,
  };
}

describe("GetDeviceMeasurementsUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: GetDeviceMeasurementsUseCase;
  let databricksAdapter: DatabricksAdapter;
  let servingStore: ServingStorePort;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    useCase = testApp.module.get(GetDeviceMeasurementsUseCase);
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

  it("returns the newest rows and asks the warehouse for a bounded page", async () => {
    const getRecent = vi
      .spyOn(databricksAdapter, "getDeviceRecentMeasurements")
      .mockResolvedValue(success([row("2026-08-13T09:00:00.000Z")]));

    const result = await useCase.execute(THING, FROM, TO, "warehouse");

    assertSuccess(result);
    expect(result.value).toHaveLength(1);
    expect(result.value[0].timestamp).toBe("2026-08-13T09:00:00.000Z");
    // Row-level evidence, not an export: the read stays capped.
    expect(getRecent).toHaveBeenCalledWith(THING, FROM, TO, 50);
  });

  it("drops a row whose timestamp did not parse, since it cannot be placed in time", async () => {
    vi.spyOn(databricksAdapter, "getDeviceRecentMeasurements").mockResolvedValue(
      success([row(null), row("2026-08-13T09:00:00.000Z")]),
    );

    const result = await useCase.execute(THING, FROM, TO, "warehouse");

    assertSuccess(result);
    expect(result.value).toHaveLength(1);
  });

  it("propagates a warehouse failure", async () => {
    vi.spyOn(databricksAdapter, "getDeviceRecentMeasurements").mockResolvedValue(
      failure(AppError.internal("warehouse down")),
    );

    const result = await useCase.execute(THING, FROM, TO, "warehouse");

    assertFailure(result);
  });

  it("answers the same from the store as from the warehouse", async () => {
    const rows = [row("2026-08-13T09:00:00.000Z"), row(null)];
    const warehouse = vi
      .spyOn(databricksAdapter, "getDeviceRecentMeasurements")
      .mockResolvedValue(success(rows));
    const store = vi
      .spyOn(servingStore, "getDeviceRecentMeasurements")
      .mockResolvedValue(success(rows));

    const fromWarehouse = await useCase.execute(THING, FROM, TO, "warehouse");
    const fromStore = await useCase.execute(THING, FROM, TO, "store");

    assertSuccess(fromWarehouse);
    assertSuccess(fromStore);
    expect(fromStore.value).toEqual(fromWarehouse.value);
    expect(warehouse).toHaveBeenCalledOnce();
    expect(store).toHaveBeenCalledOnce();
    expect(store).toHaveBeenCalledWith(THING, FROM, TO, 50);
  });
});
