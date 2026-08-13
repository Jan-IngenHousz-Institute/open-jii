import { DatabricksAdapter } from "../../../../common/modules/databricks/databricks.adapter";
import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { GetDevicePayloadStatsUseCase } from "./get-device-payload-stats";

const THING = "AMBYTE_A";
const FROM = "2026-08-13T00:00:00.000Z";
const TO = "2026-08-13T12:00:00.000Z";

describe("GetDevicePayloadStatsUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: GetDevicePayloadStatsUseCase;
  let databricksAdapter: DatabricksAdapter;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    useCase = testApp.module.get(GetDevicePayloadStatsUseCase);
    databricksAdapter = testApp.module.get(DatabricksAdapter);
    vi.spyOn(databricksAdapter, "getDevicePayloadCoverage").mockResolvedValue(success([]));
    vi.spyOn(databricksAdapter, "getDevicePayloadMix").mockResolvedValue(success([]));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("sums daily coverage and counts distinct workbook runs", async () => {
    vi.spyOn(databricksAdapter, "getDevicePayloadCoverage").mockResolvedValue(
      success([
        { total: 40, withGps: 30, withBattery: 40, withWorkbookRun: 10 },
        { total: 60, withGps: 10, withBattery: 55, withWorkbookRun: 20 },
      ]),
    );
    vi.spyOn(databricksAdapter, "getDevicePayloadMix").mockImplementation((_t, _f, _o, column) => {
      if (column === "workbook_run_id") {
        return Promise.resolve(
          success([
            { value: "run-1", count: 10 },
            { value: "run-2", count: 20 },
            { value: null, count: 70 },
          ]),
        );
      }
      if (column === "device_version") {
        return Promise.resolve(
          success([
            { value: "1.0.0", count: 30 },
            { value: "1.1.0", count: 70 },
          ]),
        );
      }
      return Promise.resolve(success([{ value: null, count: 100 }]));
    });

    const result = await useCase.execute(THING, FROM, TO);

    assertSuccess(result);
    expect(result.value.totalMeasurements).toBe(100);
    expect(result.value.withGps).toBe(40);
    expect(result.value.withBattery).toBe(95);
    expect(result.value.workbookRuns).toBe(2);
    // Firmware mix sorted by count descending; null protocol groups dropped
    // (protocol attribution only exists on legacy-topic rows).
    expect(result.value.firmwareMix[0]).toEqual({ version: "1.1.0", count: 70 });
    expect(result.value.protocolMix).toEqual([]);
  });

  it("propagates a warehouse failure from any of the parallel queries", async () => {
    vi.spyOn(databricksAdapter, "getDevicePayloadCoverage").mockResolvedValue(
      failure(AppError.internal("warehouse down")),
    );

    const result = await useCase.execute(THING, FROM, TO);

    assertFailure(result);
  });
});
