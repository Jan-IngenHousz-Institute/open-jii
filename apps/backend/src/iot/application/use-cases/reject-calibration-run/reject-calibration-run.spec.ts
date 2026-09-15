import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { IotCalibrationDefinitionRepository } from "../../../core/repositories/iot-calibration-definition.repository";
import { IotCalibrationRunRepository } from "../../../core/repositories/iot-calibration-run.repository";
import { RejectCalibrationRunUseCase } from "./reject-calibration-run";

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

describe("RejectCalibrationRunUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: RejectCalibrationRunUseCase;
  let runRepository: IotCalibrationRunRepository;
  let userId: string;
  let deviceId: string;
  let definitionId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Calibration Reviewer" });
    useCase = testApp.module.get(RejectCalibrationRunUseCase);
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

  const seedComputedRun = async () => {
    const created = await runRepository.create({
      definitionId,
      deviceId,
      requestedBy: userId,
      inputSource: "bench_wizard",
      status: "running",
    });
    assertSuccess(created);
    const saved = await runRepository.saveResult(created.value.id, {
      status: "computed",
      blocks: { par: { status: "computed", coefficients: { spec: 1.19 } } },
    });
    assertSuccess(saved);
    return created.value.id;
  };

  it("rejects a computed run and keeps its diagnostics", async () => {
    const runId = await seedComputedRun();

    const result = await useCase.execute(runId, userId);

    assertSuccess(result);
    expect(result.value.status).toBe("rejected");
    expect(result.value.reviewedBy).toBe(userId);
    expect(result.value.blocks?.par.coefficients).toEqual({ spec: 1.19 });
  });

  it("leaves the device with no active calibration", async () => {
    await useCase.execute(await seedComputedRun(), userId);

    const active = await runRepository.findActiveByDevice(deviceId);
    assertSuccess(active);
    expect(active.value).toBeNull();
  });

  it("refuses a run that is not computed", async () => {
    const created = await runRepository.create({
      definitionId,
      deviceId,
      requestedBy: userId,
      inputSource: "bench_wizard",
      status: "running",
    });
    assertSuccess(created);

    const result = await useCase.execute(created.value.id, userId);
    assertFailure(result);
    expect(result.error.message).toContain("Only a computed run can be rejected");
  });

  it("reports a missing run as not found", async () => {
    const result = await useCase.execute(crypto.randomUUID(), userId);

    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("refuses a caller without manage rights on the device", async () => {
    const outsider = await testApp.createTestUser({ name: "Otto Outsider" });

    const result = await useCase.execute(await seedComputedRun(), outsider);
    assertFailure(result);
    expect(result.error.statusCode).toBe(403);
  });
});
