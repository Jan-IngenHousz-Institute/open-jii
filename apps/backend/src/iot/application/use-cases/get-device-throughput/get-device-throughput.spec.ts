import { DatabricksAdapter } from "../../../../common/modules/databricks/databricks.adapter";
import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { GetDeviceThroughputUseCase } from "./get-device-throughput";

const THING = "AMBYTE_A";
const FROM = "2026-08-13T00:00:00.000Z";
const TO = "2026-08-13T12:00:00.000Z";
const EXPERIMENT = "22222222-2222-4222-8222-222222222222";

describe("GetDeviceThroughputUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: GetDeviceThroughputUseCase;
  let databricksAdapter: DatabricksAdapter;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    useCase = testApp.module.get(GetDeviceThroughputUseCase);
    databricksAdapter = testApp.module.get(DatabricksAdapter);
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

    const result = await useCase.execute(THING, FROM, TO, "hour");

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

    const result = await useCase.execute(THING, FROM, TO, "hour");

    assertSuccess(result);
    expect(result.value).toEqual([
      { bucketStart: "2026-08-13T02:00:00.000Z", experimentId: null, count: 5 },
    ]);
  });

  it("propagates a warehouse failure", async () => {
    vi.spyOn(databricksAdapter, "getDeviceThroughput").mockResolvedValue(
      failure(AppError.internal("warehouse down")),
    );

    const result = await useCase.execute(THING, FROM, TO, "day");

    assertFailure(result);
  });
});
