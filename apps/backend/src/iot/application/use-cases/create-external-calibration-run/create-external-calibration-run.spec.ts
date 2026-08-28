import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { IotCalibrationDefinitionRepository } from "../../../core/repositories/iot-calibration-definition.repository";
import { CreateExternalCalibrationRunUseCase } from "./create-external-calibration-run";

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

const OUTPUT_SCHEMA = {
  blocks: { par: { spec: { type: "number" as const, min: 0.05, max: 100.0 } } },
};

describe("CreateExternalCalibrationRunUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: CreateExternalCalibrationRunUseCase;
  let userId: string;
  let deviceId: string;
  let definitionId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Bench Operator" });
    useCase = testApp.module.get(CreateExternalCalibrationRunUseCase);

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
        minFirmwareVersion: "1.1.3",
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

  const submit = (overrides: Record<string, unknown> = {}) =>
    useCase.execute(
      {
        deviceId,
        definitionId,
        blocks: { par: { status: "computed", coefficients: { spec: 1.19 } } },
        ...overrides,
      },
      userId,
    );

  it("records a bench-computed run without invoking the sandbox", async () => {
    const result = await submit();

    assertSuccess(result);
    expect(result.value.status).toBe("computed");
    expect(result.value.inputSource).toBe("external_bench");
    expect(result.value.finishedAt).not.toBeNull();
  });

  it("re-validates submitted blocks against the definition's bounds", async () => {
    const result = await submit({
      blocks: { par: { status: "computed", coefficients: { spec: 250 } } },
    });

    assertFailure(result);
    expect(result.error.message).toContain("above the allowed maximum");
  });

  it("refuses a submission whose blocks all failed or were skipped", async () => {
    const result = await submit({
      blocks: { par: { status: "rejected", reason: "R-squared below 0.99" } },
    });

    assertFailure(result);
    expect(result.error.message).toContain("No submitted block produced coefficients");
  });

  it("refuses a device whose family the definition does not target", async () => {
    const ambit = await testApp.createIotDevice({ createdBy: userId, deviceType: "ambit" });
    const result = await submit({ deviceId: ambit.id });

    assertFailure(result);
    expect(result.error.message).toContain("but the device is a");
  });

  /**
   * This is the import path for bench runs the platform never watched, and
   * historical ones legitimately predate a minimum set later, so the firmware
   * gate that guards live capture deliberately does not apply here.
   */
  it("admits a historical run from firmware below the definition's minimum", async () => {
    const result = await submit({ firmwareVersion: "1.0.0" });
    assertSuccess(result);
    expect(result.value.firmwareVersion).toBe("1.0.0");
  });
});
