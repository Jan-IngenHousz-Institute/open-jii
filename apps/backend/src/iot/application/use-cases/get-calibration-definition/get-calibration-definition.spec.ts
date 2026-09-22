import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { IotCalibrationDefinitionRepository } from "../../../core/repositories/iot-calibration-definition.repository";
import { IotCalibrationRunRepository } from "../../../core/repositories/iot-calibration-run.repository";
import { GetCalibrationDefinitionUseCase } from "./get-calibration-definition";

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

const OUTPUT_SCHEMA = { blocks: { par: { spec: { type: "number" as const } } } };

describe("GetCalibrationDefinitionUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: GetCalibrationDefinitionUseCase;
  let runRepository: IotCalibrationRunRepository;
  let userId: string;
  let definitionId: string;
  let deviceId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Calibration Author" });
    useCase = testApp.module.get(GetCalibrationDefinitionUseCase);
    runRepository = testApp.module.get(IotCalibrationRunRepository);
    const device = await testApp.createIotDevice({ createdBy: userId, deviceType: "minipar" });
    deviceId = device.id;

    const definition = await testApp.module.get(IotCalibrationDefinitionRepository).create(
      {
        family: "minipar",
        name: `PAR calibration ${crypto.randomUUID()}`,
        description: null,
        captureProcedure: PROCEDURE,
        script: "submit({})",
        outputSchema: OUTPUT_SCHEMA,
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

  // Detail is what the bench wizard interprets and the sandbox executes, so it
  // carries the procedure and script the list projection omits.
  it("returns the procedure, script, and output schema", async () => {
    const result = await useCase.execute(definitionId, userId);

    assertSuccess(result);
    expect(result.value.captureProcedure).toEqual(PROCEDURE);
    expect(result.value.outputSchema).toEqual(OUTPUT_SCHEMA);
    expect(result.value.script).toBe("submit({})");
  });

  // The update use case refuses a definition a run points at. Sending the count with the
  // definition is what lets the page say so before the author edits anything.
  it("counts the runs that have closed the definition to edits", async () => {
    const fresh = await useCase.execute(definitionId, userId);
    assertSuccess(fresh);
    expect(fresh.value.runCount).toBe(0);

    const run = await runRepository.create({
      definitionId,
      deviceId,
      requestedBy: userId,
      inputSource: "bench_wizard",
      status: "computed",
    });
    assertSuccess(run);

    const afterRun = await useCase.execute(definitionId, userId);
    assertSuccess(afterRun);
    expect(afterRun.value.runCount).toBe(1);
  });

  it("reports a missing definition", async () => {
    const result = await useCase.execute(crypto.randomUUID(), userId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });
});
