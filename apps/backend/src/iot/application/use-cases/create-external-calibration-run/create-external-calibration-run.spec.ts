import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import type { CalibrationBlocks } from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { calibrationDefinitions, eq } from "@repo/database";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import {
  calibrationDeliveries,
  calibrationNotifications,
  heardBy,
  seedCalibrationAudience,
} from "../../../../test/calibration-audience";
import type { CalibrationAudience } from "../../../../test/calibration-audience";
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

  // The route guard authorizes the device, not the definition named in the body.
  it("refuses a submission against a definition the caller cannot read", async () => {
    await testApp.database
      .update(calibrationDefinitions)
      .set({ visibility: "private" })
      .where(eq(calibrationDefinitions.id, definitionId));
    const outsider = await testApp.createTestUser({ name: "Otto Outsider" });

    const result = await useCase.execute(
      {
        deviceId,
        definitionId,
        blocks: { par: { status: "computed", coefficients: { spec: 1.19 } } },
      },
      outsider,
    );

    assertFailure(result);
    expect(result.error.statusCode).toBe(403);
  });

  it("reports a missing definition or device as not found", async () => {
    const noDefinition = await submit({ definitionId: crypto.randomUUID() });
    assertFailure(noDefinition);
    expect(noDefinition.error.statusCode).toBe(404);

    const noDevice = await submit({ deviceId: crypto.randomUUID() });
    assertFailure(noDevice);
    expect(noDevice.error.statusCode).toBe(404);
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

  describe("notifications", () => {
    let audience: CalibrationAudience;
    let parSweepId: string;

    beforeEach(async () => {
      audience = await seedCalibrationAudience(testApp);
      const definition = await testApp.module.get(IotCalibrationDefinitionRepository).create(
        {
          family: "minipar",
          name: "PAR sweep",
          description: null,
          captureProcedure: PROCEDURE,
          script: "submit({})",
          outputSchema: OUTPUT_SCHEMA,
          minFirmwareVersion: null,
        },
        userId,
      );
      assertSuccess(definition);
      parSweepId = definition.value[0].id;
    });

    const submitAsRequester = (blocks: CalibrationBlocks) =>
      useCase.execute(
        { deviceId: audience.deviceId, definitionId: parSweepId, blocks },
        audience.requester,
      );

    it("tells the owner and the device's managers, not the requester, and queues their emails", async () => {
      assertSuccess(
        await submitAsRequester({ par: { status: "computed", coefficients: { spec: 1.19 } } }),
      );

      expect(await calibrationNotifications(testApp, audience)).toEqual(
        heardBy(audience, ["owner", "manager"], (recipientId) => ({
          type: "calibration_run_awaiting_approval",
          recipientId,
          actorId: audience.requester,
          resourceType: "device",
          resourceId: audience.deviceId,
          params: { deviceName: "Test device", definitionName: "PAR sweep" },
        })),
      );
      expect(await calibrationDeliveries(testApp, audience)).toEqual(
        heardBy(audience, ["owner", "manager"], () => ({
          type: "calibration_run_awaiting_approval",
          status: "pending",
        })),
      );
    });

    it("tells nobody about a submission it refused", async () => {
      assertFailure(
        await submitAsRequester({ par: { status: "skipped", reason: "no reference connected" } }),
      );

      expect(await calibrationNotifications(testApp, audience)).toEqual(
        heardBy(audience, [], () => null),
      );
    });
  });
});
