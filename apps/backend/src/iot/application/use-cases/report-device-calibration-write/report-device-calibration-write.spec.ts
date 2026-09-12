import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { IotCalibrationDefinitionRepository } from "../../../core/repositories/iot-calibration-definition.repository";
import { IotCalibrationRunRepository } from "../../../core/repositories/iot-calibration-run.repository";
import { ApproveCalibrationRunUseCase } from "../approve-calibration-run/approve-calibration-run";
import { ReportDeviceCalibrationWriteUseCase } from "./report-device-calibration-write";

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

describe("ReportDeviceCalibrationWriteUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: ReportDeviceCalibrationWriteUseCase;
  let userId: string;
  let calibrationId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Bench Operator" });
    useCase = testApp.module.get(ReportDeviceCalibrationWriteUseCase);

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

    const runRepository = testApp.module.get(IotCalibrationRunRepository);
    const run = await runRepository.create({
      definitionId: definition.value[0].id,
      deviceId: device.id,
      requestedBy: userId,
      inputSource: "bench_wizard",
      status: "running",
    });
    assertSuccess(run);
    const computed = await runRepository.saveResult(run.value.id, {
      status: "computed",
      blocks: { par: { status: "computed", coefficients: { spec: 1.19 } } },
    });
    assertSuccess(computed);

    const approved = await testApp.module
      .get(ApproveCalibrationRunUseCase)
      .execute(run.value.id, userId);
    assertSuccess(approved);
    calibrationId = approved.value.id;
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("records a verified write against the applied row", async () => {
    const result = await useCase.execute(
      { calibrationId, writeResults: { par: { verified: true } } },
      userId,
    );

    assertSuccess(result);
    expect(result.value.writtenToDeviceAt).not.toBeNull();
    expect(result.value.writeResults).toEqual({ par: { verified: true } });
  });

  // A readback mismatch rolls the gain back at the bench; the record has to be
  // able to say a block was written and did not stick.
  it("records a failed write with its error", async () => {
    const result = await useCase.execute(
      {
        calibrationId,
        writeResults: { par: { verified: false, error: "readback was 1.0000, expected 1.1900" } },
      },
      userId,
    );

    assertSuccess(result);
    expect(result.value.writeResults?.par.verified).toBe(false);
    expect(result.value.writeResults?.par.error).toContain("readback");
  });

  // The device's state after the write belongs on the run beside the state it
  // was created with, so a later reader sees both ends of the session.
  it("stores the reported post-write device state on the run", async () => {
    const result = await useCase.execute(
      {
        calibrationId,
        writeResults: { par: { verified: true } },
        postInfo: { helloReply: "MiniPAR 1.03 cal_par_slope=1.19" },
      },
      userId,
    );

    assertSuccess(result);
    const run = await testApp.module.get(IotCalibrationRunRepository).findById(result.value.runId);
    assertSuccess(run);
    expect(run.value?.postInfo).toEqual({ helloReply: "MiniPAR 1.03 cal_par_slope=1.19" });
  });

  it("refuses results naming a block this calibration did not apply", async () => {
    const result = await useCase.execute(
      { calibrationId, writeResults: { led: { verified: true } } },
      userId,
    );

    assertFailure(result);
    expect(result.error.message).toContain("did not apply");
  });

  it("refuses a caller without manage rights on the device", async () => {
    const outsider = await testApp.createTestUser({ name: "Otto Outsider" });
    const result = await useCase.execute(
      { calibrationId, writeResults: { par: { verified: true } } },
      outsider,
    );

    assertFailure(result);
    expect(result.error.statusCode).toBe(403);
  });

  it("reports a missing calibration rather than failing opaquely", async () => {
    const result = await useCase.execute(
      { calibrationId: crypto.randomUUID(), writeResults: { par: { verified: true } } },
      userId,
    );

    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });
});
