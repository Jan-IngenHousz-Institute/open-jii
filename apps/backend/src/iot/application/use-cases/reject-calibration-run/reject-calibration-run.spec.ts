import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";

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

  // A run the sandbox could not finish has no other way to a terminal state; left open it
  // sits at the top of the device's history forever.
  it("closes a run that failed to compute", async () => {
    const created = await runRepository.create({
      definitionId,
      deviceId,
      requestedBy: userId,
      inputSource: "bench_wizard",
      status: "running",
    });
    assertSuccess(created);
    const failed = await runRepository.saveResult(created.value.id, {
      status: "error",
      errorMessage: "Calibration sandbox invoke failed",
    });
    assertSuccess(failed);

    const result = await useCase.execute(created.value.id, userId);

    assertSuccess(result);
    expect(result.value.status).toBe("rejected");
    expect(result.value.errorMessage).toBe("Calibration sandbox invoke failed");
  });

  // One still computing settles on its own when the sandbox answers.
  it("refuses a run that is still running", async () => {
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
    expect(result.error.message).toContain("Only a computed or failed run can be rejected");
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

  describe("notifications", () => {
    let audience: CalibrationAudience;
    let definitionName: string;

    beforeEach(async () => {
      audience = await seedCalibrationAudience(testApp);
      // Only someone who can work on the device starts a run, so the requester holds Can edit.
      await testApp.addResourceGrant({
        resourceType: "device",
        resourceId: audience.deviceId,
        granteeType: "user",
        granteeId: audience.requester,
        role: "admin",
      });
      const definition = await testApp.module
        .get(IotCalibrationDefinitionRepository)
        .findById(definitionId);
      assertSuccess(definition);
      definitionName = definition.value?.name ?? "";
    });

    const seedRunBy = async (
      requestedBy: string,
      status: "computed" | "compute_failed" | "running" = "computed",
    ) => {
      const created = await runRepository.create({
        definitionId,
        deviceId: audience.deviceId,
        requestedBy,
        inputSource: "bench_wizard",
        status: "running",
      });
      assertSuccess(created);
      if (status === "computed") {
        assertSuccess(
          await runRepository.saveResult(created.value.id, {
            status,
            blocks: { par: { status: "computed", coefficients: { spec: 1.19 } } },
          }),
        );
      }
      if (status === "compute_failed") {
        assertSuccess(
          await runRepository.saveResult(created.value.id, {
            status,
            errorMessage: "No block produced coefficients",
          }),
        );
      }
      return created.value.id;
    };

    it.each(["computed", "compute_failed"] as const)(
      "tells the requester who rejected a %s run, and nobody else",
      async (status) => {
        const runId = await seedRunBy(audience.requester, status);

        assertSuccess(await useCase.execute(runId, audience.manager));

        expect(await calibrationNotifications(testApp, audience)).toEqual(
          heardBy(audience, ["requester"], (recipientId) => ({
            type: "calibration_run_rejected",
            recipientId,
            actorId: audience.manager,
            resourceType: "device",
            resourceId: audience.deviceId,
            params: { deviceName: "Test device", definitionName },
          })),
        );
        expect(await calibrationDeliveries(testApp, audience)).toEqual(
          heardBy(audience, ["requester"], () => ({
            type: "calibration_run_rejected",
            status: "pending",
          })),
        );
      },
    );

    it("tells nobody when the reviewer rejects a run they requested", async () => {
      assertSuccess(await useCase.execute(await seedRunBy(audience.manager), audience.manager));

      expect(await calibrationNotifications(testApp, audience)).toEqual(
        heardBy(audience, [], () => null),
      );
    });

    it("tells nobody when the rejection is refused", async () => {
      assertFailure(
        await useCase.execute(await seedRunBy(audience.requester, "running"), audience.manager),
      );

      expect(await calibrationNotifications(testApp, audience)).toEqual(
        heardBy(audience, [], () => null),
      );
    });
  });
});
