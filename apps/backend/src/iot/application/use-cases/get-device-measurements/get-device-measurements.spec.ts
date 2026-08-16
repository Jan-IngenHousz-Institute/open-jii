import { DatabricksAdapter } from "../../../../common/modules/databricks/databricks.adapter";
import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
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

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    useCase = testApp.module.get(GetDeviceMeasurementsUseCase);
    databricksAdapter = testApp.module.get(DatabricksAdapter);
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

    const result = await useCase.execute(THING, FROM, TO);

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

    const result = await useCase.execute(THING, FROM, TO);

    assertSuccess(result);
    expect(result.value).toHaveLength(1);
  });

  it("propagates a warehouse failure", async () => {
    vi.spyOn(databricksAdapter, "getDeviceRecentMeasurements").mockResolvedValue(
      failure(AppError.internal("warehouse down")),
    );

    const result = await useCase.execute(THING, FROM, TO);

    assertFailure(result);
  });
});
