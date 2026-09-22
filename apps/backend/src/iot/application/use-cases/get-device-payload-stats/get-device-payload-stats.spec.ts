import { DatabricksAdapter } from "../../../../common/modules/databricks/databricks.adapter";
import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { WorkbookVersionRepository } from "../../../../workbooks/core/repositories/workbook-version.repository";
import { GetDevicePayloadStatsUseCase } from "./get-device-payload-stats";

const THING = "AMBYTE_A";
const FROM = "2026-08-13T00:00:00.000Z";
const TO = "2026-08-13T12:00:00.000Z";
// Distinct on purpose: a device reports the version, never the workbook.
const VERSION_ID = "11111111-1111-4111-8111-111111111111";
const WORKBOOK_ID = "22222222-2222-4222-8222-222222222222";

describe("GetDevicePayloadStatsUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: GetDevicePayloadStatsUseCase;
  let databricksAdapter: DatabricksAdapter;
  let workbookVersionRepository: WorkbookVersionRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    useCase = testApp.module.get(GetDevicePayloadStatsUseCase);
    databricksAdapter = testApp.module.get(DatabricksAdapter);
    workbookVersionRepository = testApp.module.get(WorkbookVersionRepository);
    vi.spyOn(databricksAdapter, "getDevicePayloadBreakdown").mockResolvedValue(success([]));
    vi.spyOn(databricksAdapter, "getDeviceMacroBreakdown").mockResolvedValue(success([]));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("folds the grouped breakdown into totals, mixes, and distinct runs", async () => {
    vi.spyOn(databricksAdapter, "getDevicePayloadBreakdown").mockResolvedValue(
      success([
        // run-1 spans two firmware versions: one run, not two.
        {
          deviceVersion: "1.0.0",
          protocolId: null,
          workbookVersionId: null,
          workbookRunId: "run-1",
          count: 10,
          withGps: 5,
          withBattery: 10,
        },
        {
          deviceVersion: "1.1.0",
          protocolId: null,
          workbookVersionId: null,
          workbookRunId: "run-1",
          count: 20,
          withGps: 15,
          withBattery: 15,
        },
        {
          deviceVersion: "1.1.0",
          protocolId: null,
          workbookVersionId: null,
          workbookRunId: "run-2",
          count: 50,
          withGps: 20,
          withBattery: 50,
        },
        {
          deviceVersion: "1.1.0",
          protocolId: null,
          workbookVersionId: null,
          workbookRunId: null,
          count: 20,
          withGps: 0,
          withBattery: 20,
        },
      ]),
    );

    const result = await useCase.execute(THING, FROM, TO);

    assertSuccess(result);
    expect(result.value.totalMeasurements).toBe(100);
    expect(result.value.withGps).toBe(40);
    expect(result.value.withBattery).toBe(95);
    expect(result.value.workbookRuns).toBe(2);
    expect(result.value.firmwareMix).toEqual([
      { version: "1.1.0", count: 90 },
      { version: "1.0.0", count: 10 },
    ]);
    expect(result.value.protocolMix).toEqual([]);
  });

  it("keeps legacy protocol groups and drops only the null attribution", async () => {
    vi.spyOn(databricksAdapter, "getDevicePayloadBreakdown").mockResolvedValue(
      success([
        {
          deviceVersion: null,
          protocolId: "proto-1",
          workbookVersionId: null,
          workbookRunId: null,
          count: 12,
          withGps: 0,
          withBattery: 0,
        },
        {
          deviceVersion: null,
          protocolId: null,
          workbookVersionId: null,
          workbookRunId: null,
          count: 88,
          withGps: 0,
          withBattery: 0,
        },
      ]),
    );

    const result = await useCase.execute(THING, FROM, TO);

    assertSuccess(result);
    expect(result.value.protocolMix).toEqual([{ protocolId: "proto-1", count: 12 }]);
  });

  it("orders the macro mix by how often each macro ran", async () => {
    vi.spyOn(databricksAdapter, "getDeviceMacroBreakdown").mockResolvedValue(
      success([
        { macroId: "macro-a", count: 12 },
        { macroId: "macro-b", count: 40 },
      ]),
    );

    const result = await useCase.execute(THING, FROM, TO);

    assertSuccess(result);
    expect(result.value.macroMix).toEqual([
      { macroId: "macro-b", count: 40 },
      { macroId: "macro-a", count: 12 },
    ]);
  });

  it("attributes a reported workbook version to the workbook that owns it", async () => {
    vi.spyOn(databricksAdapter, "getDevicePayloadBreakdown").mockResolvedValue(
      success([
        {
          deviceVersion: null,
          protocolId: null,
          workbookVersionId: VERSION_ID,
          workbookRunId: null,
          count: 7,
          withGps: 0,
          withBattery: 0,
        },
      ]),
    );
    vi.spyOn(workbookVersionRepository, "findWorkbookRefsByIds").mockResolvedValue(
      success([{ id: VERSION_ID, workbookId: WORKBOOK_ID, version: 4 }]),
    );

    const result = await useCase.execute(THING, FROM, TO);

    assertSuccess(result);
    // The version id alone matches no workbook the caller can list, so the
    // owning workbook has to travel with it.
    expect(result.value.workbookMix).toEqual([
      { workbookVersionId: VERSION_ID, workbookId: WORKBOOK_ID, workbookVersion: 4, count: 7 },
    ]);
  });

  it("leaves a version the registry does not know unattributed", async () => {
    vi.spyOn(databricksAdapter, "getDevicePayloadBreakdown").mockResolvedValue(
      success([
        {
          deviceVersion: null,
          protocolId: null,
          workbookVersionId: VERSION_ID,
          workbookRunId: null,
          count: 3,
          withGps: 0,
          withBattery: 0,
        },
      ]),
    );
    vi.spyOn(workbookVersionRepository, "findWorkbookRefsByIds").mockResolvedValue(success([]));

    const result = await useCase.execute(THING, FROM, TO);

    assertSuccess(result);
    expect(result.value.workbookMix).toEqual([
      { workbookVersionId: VERSION_ID, workbookId: null, workbookVersion: null, count: 3 },
    ]);
  });

  it("propagates a failure of the workbook lookup", async () => {
    vi.spyOn(databricksAdapter, "getDevicePayloadBreakdown").mockResolvedValue(
      success([
        {
          deviceVersion: null,
          protocolId: null,
          workbookVersionId: VERSION_ID,
          workbookRunId: null,
          count: 1,
          withGps: 0,
          withBattery: 0,
        },
      ]),
    );
    vi.spyOn(workbookVersionRepository, "findWorkbookRefsByIds").mockResolvedValue(
      failure(AppError.internal("registry down")),
    );

    const result = await useCase.execute(THING, FROM, TO);

    assertFailure(result);
  });

  it("propagates a failure of the macro scan too", async () => {
    vi.spyOn(databricksAdapter, "getDeviceMacroBreakdown").mockResolvedValue(
      failure(AppError.internal("warehouse down")),
    );

    const result = await useCase.execute(THING, FROM, TO);

    assertFailure(result);
  });

  it("propagates a warehouse failure", async () => {
    vi.spyOn(databricksAdapter, "getDevicePayloadBreakdown").mockResolvedValue(
      failure(AppError.internal("warehouse down")),
    );

    const result = await useCase.execute(THING, FROM, TO);

    assertFailure(result);
  });
});
