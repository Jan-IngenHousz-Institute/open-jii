import { DatabricksAdapter } from "../../../../common/modules/databricks/databricks.adapter";
import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { GetExperimentDeviceSeriesUseCase } from "./get-experiment-device-series";

const FROM = "2026-08-04T12:00:00.000Z";
const TO = "2026-09-03T12:00:00.000Z";

describe("GetExperimentDeviceSeriesUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: GetExperimentDeviceSeriesUseCase;
  let databricksAdapter: DatabricksAdapter;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Owner" });
    useCase = testApp.module.get(GetExperimentDeviceSeriesUseCase);
    databricksAdapter = testApp.module.get(DatabricksAdapter);
    vi.spyOn(databricksAdapter, "getExperimentDeviceSeries").mockResolvedValue(success([]));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("returns the device's buckets for a member", async () => {
    const { experiment } = await testApp.createExperiment({ name: "E", userId });
    vi.spyOn(databricksAdapter, "getExperimentDeviceSeries").mockResolvedValue(
      success([{ bucketStart: "2026-09-01T00:00:00.000Z", count: 12 }]),
    );

    const result = await useCase.execute(experiment.id, "AMBYTE_A", FROM, TO, "day", userId);

    assertSuccess(result);
    expect(result.value.buckets).toEqual([{ bucketStart: "2026-09-01T00:00:00.000Z", count: 12 }]);
    expect(result.value.pipelineUnavailable).toBe(false);
  });

  it("serves a client id with no registry row, which is the whole point of the key", async () => {
    const { experiment } = await testApp.createExperiment({ name: "E", userId });
    vi.spyOn(databricksAdapter, "getExperimentDeviceSeries").mockResolvedValue(
      success([{ bucketStart: "2026-09-01T00:00:00.000Z", count: 3 }]),
    );

    // A Cognito publisher: no device to authorize against, only the experiment.
    const result = await useCase.execute(experiment.id, "cognito-abc", FROM, TO, "day", userId);

    assertSuccess(result);
    expect(result.value.buckets).toHaveLength(1);
  });

  it("flags the pipeline instead of failing when the warehouse is down", async () => {
    const { experiment } = await testApp.createExperiment({ name: "E", userId });
    vi.spyOn(databricksAdapter, "getExperimentDeviceSeries").mockResolvedValue(
      failure(AppError.internal("warehouse down")),
    );

    const result = await useCase.execute(experiment.id, "AMBYTE_A", FROM, TO, "day", userId);

    assertSuccess(result);
    expect(result.value.buckets).toEqual([]);
    expect(result.value.pipelineUnavailable).toBe(true);
  });

  it("returns not found for an unknown experiment", async () => {
    const result = await useCase.execute(
      "11111111-1111-4111-8111-111111111111",
      "AMBYTE_A",
      FROM,
      TO,
      "day",
      userId,
    );

    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("refuses a stranger who only reaches the experiment through public visibility", async () => {
    const { experiment } = await testApp.createExperiment({
      name: "Public",
      userId,
      visibility: "public",
    });
    const stranger = await testApp.createTestUser({ name: "Stranger" });

    const result = await useCase.execute(experiment.id, "AMBYTE_A", FROM, TO, "day", stranger);

    assertFailure(result);
    expect(result.error.statusCode).toBe(403);
  });
});
