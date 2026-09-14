import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";

import { assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { IotCalibrationDefinitionRepository } from "../../../core/repositories/iot-calibration-definition.repository";
import { IotCalibrationRunRepository } from "../../../core/repositories/iot-calibration-run.repository";
import { GetActiveDeviceCalibrationUseCase } from "./get-active-device-calibration";

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

describe("GetActiveDeviceCalibrationUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: GetActiveDeviceCalibrationUseCase;
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
    useCase = testApp.module.get(GetActiveDeviceCalibrationUseCase);
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

  it("returns null for a device that was never calibrated", async () => {
    const result = await useCase.execute(deviceId);
    assertSuccess(result);
    expect(result.value).toBeNull();
  });

  it("returns the calibration currently in force, not a superseded one", async () => {
    await approveRun(1.19);
    const newest = await approveRun(1.21);

    const result = await useCase.execute(deviceId);

    assertSuccess(result);
    expect(result.value?.id).toBe(newest);
    expect(result.value?.blocks.par.coefficients).toEqual({ spec: 1.21 });
    expect(result.value?.supersededAt).toBeNull();
  });
});
