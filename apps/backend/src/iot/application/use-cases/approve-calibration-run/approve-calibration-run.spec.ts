import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import type { CalibrationBlocks } from "@repo/api/domains/iot/calibration/iot-calibration.schema";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { IotCalibrationDefinitionRepository } from "../../../core/repositories/iot-calibration-definition.repository";
import { IotCalibrationRunRepository } from "../../../core/repositories/iot-calibration-run.repository";
import { ApproveCalibrationRunUseCase } from "./approve-calibration-run";

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
  blocks: {
    par: { spec: { type: "number" as const, min: 0.05, max: 100.0 } },
    led: { act: { type: "number" as const } },
  },
};

describe("ApproveCalibrationRunUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: ApproveCalibrationRunUseCase;
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
    useCase = testApp.module.get(ApproveCalibrationRunUseCase);
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

  const seedRun = async (
    blocks: CalibrationBlocks,
    status: "computed" | "running" = "computed",
  ) => {
    const created = await runRepository.create({
      definitionId,
      deviceId,
      requestedBy: userId,
      inputSource: "bench_wizard",
      status: "running",
    });
    assertSuccess(created);
    if (status === "computed") {
      const saved = await runRepository.saveResult(created.value.id, {
        status: "computed",
        blocks,
      });
      assertSuccess(saved);
    }
    return created.value.id;
  };

  const PARTIAL: CalibrationBlocks = {
    par: { status: "computed", coefficients: { spec: 1.19 } },
    led: { status: "skipped", reason: "no reference connected" },
  };

  it("applies only the computed blocks of a partial session", async () => {
    const runId = await seedRun(PARTIAL);

    const approved = await useCase.execute(runId, userId);

    assertSuccess(approved);
    expect(Object.keys(approved.value.blocks)).toEqual(["par"]);
    expect(approved.value.blocks.par.coefficients).toEqual({ spec: 1.19 });
    expect(approved.value.supersededAt).toBeNull();
  });

  it("supersedes the previous active calibration", async () => {
    const first = await useCase.execute(await seedRun(PARTIAL), userId);
    assertSuccess(first);

    const second = await useCase.execute(await seedRun(PARTIAL), userId);
    assertSuccess(second);

    const active = await runRepository.findActiveByDevice(deviceId);
    assertSuccess(active);
    expect(active.value?.id).toBe(second.value.id);
  });

  it("refuses a run that is not computed", async () => {
    const result = await useCase.execute(await seedRun(PARTIAL, "running"), userId);
    assertFailure(result);
    expect(result.error.message).toContain("Only a computed run can be approved");
  });

  it("refuses a run whose blocks all failed or were skipped", async () => {
    const runId = await seedRun({
      par: { status: "rejected", reason: "R-squared below 0.99" },
      led: { status: "skipped", reason: "no reference connected" },
    });

    const result = await useCase.execute(runId, userId);
    assertFailure(result);
    expect(result.error.message).toContain("no coefficients to apply");
  });

  // Intake validated these, but the definition's bounds are what a coefficient
  // is about to be trusted against, so approval re-checks them.
  it("refuses blocks that no longer satisfy the definition's bounds", async () => {
    const runId = await seedRun({
      par: { status: "computed", coefficients: { spec: 250 } },
      led: { status: "skipped", reason: "no reference connected" },
    });

    const result = await useCase.execute(runId, userId);
    assertFailure(result);
    expect(result.error.message).toContain("above the allowed maximum");
  });

  it("refuses a caller without manage rights on the device", async () => {
    const runId = await seedRun(PARTIAL);
    const outsider = await testApp.createTestUser({ name: "Otto Outsider" });

    const result = await useCase.execute(runId, outsider);
    assertFailure(result);
    expect(result.error.statusCode).toBe(403);
  });

  it("reports a missing run rather than failing opaquely", async () => {
    const result = await useCase.execute(crypto.randomUUID(), userId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });
});
