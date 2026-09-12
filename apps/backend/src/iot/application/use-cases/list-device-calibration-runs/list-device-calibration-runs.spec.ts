import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";

import { assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { IotCalibrationDefinitionRepository } from "../../../core/repositories/iot-calibration-definition.repository";
import { IotCalibrationRunRepository } from "../../../core/repositories/iot-calibration-run.repository";
import { ListDeviceCalibrationRunsUseCase } from "./list-device-calibration-runs";

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

describe("ListDeviceCalibrationRunsUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: ListDeviceCalibrationRunsUseCase;
  let runRepository: IotCalibrationRunRepository;
  let userId: string;
  let deviceId: string;
  let otherDeviceId: string;
  let definitionId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Calibration Operator" });
    useCase = testApp.module.get(ListDeviceCalibrationRunsUseCase);
    runRepository = testApp.module.get(IotCalibrationRunRepository);

    deviceId = (await testApp.createIotDevice({ createdBy: userId, deviceType: "minipar" })).id;
    otherDeviceId = (await testApp.createIotDevice({ createdBy: userId, deviceType: "minipar" }))
      .id;

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

  const seedRun = async (targetDeviceId: string) => {
    const run = await runRepository.create({
      definitionId,
      deviceId: targetDeviceId,
      requestedBy: userId,
      inputSource: "bench_wizard",
      status: "running",
    });
    assertSuccess(run);
    return run.value.id;
  };

  it("lists only the given device's runs", async () => {
    const mine = await seedRun(deviceId);
    const other = await seedRun(otherDeviceId);

    const result = await useCase.execute(deviceId);

    assertSuccess(result);
    const ids = result.value.map((row) => row.id);
    expect(ids).toContain(mine);
    expect(ids).not.toContain(other);
  });

  it("returns an empty list for a device that was never calibrated", async () => {
    const result = await useCase.execute(otherDeviceId);
    assertSuccess(result);
    expect(result.value).toEqual([]);
  });
});
