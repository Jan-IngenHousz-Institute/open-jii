import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";

import { assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { IotCalibrationDefinitionRepository } from "../../../core/repositories/iot-calibration-definition.repository";
import { IotCalibrationRunRepository } from "../../../core/repositories/iot-calibration-run.repository";
import { ListDeviceCalibrationsUseCase } from "./list-device-calibrations";

const PROCEDURE: CaptureProcedure = {
  instruments: [{ role: "dut" }],
  steps: [
    {
      kind: "read",
      series: "par_sweep",
      read: [{ instrument: "dut", command: "get_par", as: "par_raw" }],
    },
  ],
};

describe("ListDeviceCalibrationsUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: ListDeviceCalibrationsUseCase;
  let runRepository: IotCalibrationRunRepository;
  let userId: string;
  let deviceId: string;
  let definitionId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Calibration Operator" });
    useCase = testApp.module.get(ListDeviceCalibrationsUseCase);
    runRepository = testApp.module.get(IotCalibrationRunRepository);

    deviceId = (await testApp.createIotDevice({ createdBy: userId, deviceType: "minipar" })).id;

    const definition = await testApp.module.get(IotCalibrationDefinitionRepository).create(
      {
        family: "minipar",
        name: `PAR calibration ${crypto.randomUUID()}`,
        description: null,
        captureProcedure: PROCEDURE,
        script: "submit({})",
        outputSchema: { blocks: { par: { spec: { type: "number" } } } },
        minFirmwareVersion: null,
      },
      userId,
    );
    assertSuccess(definition);
    definitionId = definition.value[0].id;
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const approveRun = async (spec: number) => {
    const run = await runRepository.create({
      definitionId,
      deviceId,
      requestedBy: userId,
      inputSource: "bench_wizard",
      status: "running",
    });
    assertSuccess(run);
    const approved = await runRepository.approve(
      run.value.id,
      deviceId,
      { par: { coefficients: { spec } } },
      userId,
    );
    assertSuccess(approved);
    return approved.value.id;
  };

  // The history is the audit trail: superseded rows stay so a measurement can
  // be read against the coefficient that was in force when it was taken.
  it("returns the whole history, newest first", async () => {
    const older = await approveRun(1.19);
    const newer = await approveRun(1.21);

    const result = await useCase.execute(deviceId);

    assertSuccess(result);
    expect(result.value.map((row) => row.id)).toEqual([newer, older]);
    expect(result.value[1].supersededAt).not.toBeNull();
  });

  it("returns an empty list for a device that was never calibrated", async () => {
    const other = await testApp.createIotDevice({ createdBy: userId, deviceType: "minipar" });
    const result = await useCase.execute(other.id);
    assertSuccess(result);
    expect(result.value).toEqual([]);
  });
});
