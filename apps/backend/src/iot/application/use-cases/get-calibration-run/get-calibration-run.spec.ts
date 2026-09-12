import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { IotCalibrationDefinitionRepository } from "../../../core/repositories/iot-calibration-definition.repository";
import { IotCalibrationRunRepository } from "../../../core/repositories/iot-calibration-run.repository";
import { GetCalibrationRunUseCase } from "./get-calibration-run";

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

describe("GetCalibrationRunUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: GetCalibrationRunUseCase;
  let userId: string;
  let runId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Calibration Operator" });
    useCase = testApp.module.get(GetCalibrationRunUseCase);

    const device = await testApp.createIotDevice({ createdBy: userId, deviceType: "minipar" });
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

    const run = await testApp.module.get(IotCalibrationRunRepository).create({
      definitionId: definition.value[0].id,
      deviceId: device.id,
      requestedBy: userId,
      inputSource: "bench_wizard",
      status: "running",
    });
    assertSuccess(run);
    runId = run.value.id;
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("returns the run with the definition version that produced it", async () => {
    const result = await useCase.execute(runId, userId);

    assertSuccess(result);
    expect(result.value.id).toBe(runId);
    expect(result.value.definitionVersion).toBe(1);
  });

  // The route carries a run id, not a device id, so no @CanAccess guard fires:
  // the device read check has to happen here or runs leak across devices.
  it("refuses a caller without read access to the run's device", async () => {
    const outsider = await testApp.createTestUser({ name: "Otto Outsider" });

    const result = await useCase.execute(runId, outsider);
    assertFailure(result);
    expect(result.error.statusCode).toBe(403);
  });

  it("reports a missing run", async () => {
    const result = await useCase.execute(crypto.randomUUID(), userId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });
});
