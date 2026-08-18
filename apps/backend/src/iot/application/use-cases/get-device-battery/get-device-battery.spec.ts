import { DatabricksAdapter } from "../../../../common/modules/databricks/databricks.adapter";
import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { GetDeviceBatteryUseCase } from "./get-device-battery";

const THING = "AMBYTE_A";
const FROM = "2026-08-13T00:00:00.000Z";
const TO = "2026-08-13T12:00:00.000Z";

describe("GetDeviceBatteryUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: GetDeviceBatteryUseCase;
  let databricksAdapter: DatabricksAdapter;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    useCase = testApp.module.get(GetDeviceBatteryUseCase);
    databricksAdapter = testApp.module.get(DatabricksAdapter);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("returns the series, keeping a null average for battery-less buckets", async () => {
    const getBattery = vi.spyOn(databricksAdapter, "getDeviceBatterySeries").mockResolvedValue(
      success([
        { bucketStart: "2026-08-13T01:00:00.000Z", averageBattery: 87.5 },
        { bucketStart: "2026-08-13T02:00:00.000Z", averageBattery: null },
      ]),
    );

    const result = await useCase.execute(THING, FROM, TO, "hour");

    assertSuccess(result);
    expect(result.value).toEqual([
      { bucketStart: "2026-08-13T01:00:00.000Z", averageBattery: 87.5 },
      { bucketStart: "2026-08-13T02:00:00.000Z", averageBattery: null },
    ]);
    expect(getBattery).toHaveBeenCalledWith(THING, FROM, TO, "hour");
  });

  it("drops rows whose bucket start did not parse, keeping the output contract-clean", async () => {
    vi.spyOn(databricksAdapter, "getDeviceBatterySeries").mockResolvedValue(
      success([
        { bucketStart: null, averageBattery: 50 },
        { bucketStart: "2026-08-13T03:00:00.000Z", averageBattery: 80 },
      ]),
    );

    const result = await useCase.execute(THING, FROM, TO, "day");

    assertSuccess(result);
    expect(result.value).toEqual([{ bucketStart: "2026-08-13T03:00:00.000Z", averageBattery: 80 }]);
  });

  it("propagates a warehouse failure", async () => {
    vi.spyOn(databricksAdapter, "getDeviceBatterySeries").mockResolvedValue(
      failure(AppError.internal("warehouse down")),
    );

    const result = await useCase.execute(THING, FROM, TO, "hour");

    assertFailure(result);
  });
});
