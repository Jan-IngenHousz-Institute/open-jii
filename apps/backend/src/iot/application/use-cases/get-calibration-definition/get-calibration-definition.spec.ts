import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { IotCalibrationDefinitionRepository } from "../../../core/repositories/iot-calibration-definition.repository";
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
  let userId: string;
  let definitionId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Calibration Author" });
    useCase = testApp.module.get(GetCalibrationDefinitionUseCase);

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
    const result = await useCase.execute(definitionId);

    assertSuccess(result);
    expect(result.value.captureProcedure).toEqual(PROCEDURE);
    expect(result.value.outputSchema).toEqual(OUTPUT_SCHEMA);
    expect(result.value.script).toBe("submit({})");
  });

  it("reports a missing definition", async () => {
    const result = await useCase.execute(crypto.randomUUID());
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });
});
