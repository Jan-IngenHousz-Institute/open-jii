import { faker } from "@faker-js/faker";

import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";

import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import { IotCalibrationDefinitionRepository } from "./iot-calibration-definition.repository";
import { IotCalibrationRunRepository } from "./iot-calibration-run.repository";

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

const BLOCKS = {
  par: { status: "computed" as const, coefficients: { spec: 1.19 }, quality: { passed: true } },
};

/** What approval actually stores: computed blocks without their status. */
const APPLIED = { par: { coefficients: { spec: 1.19 }, quality: { passed: true } } };

describe("IotCalibrationRunRepository", () => {
  const testApp = TestHarness.App;
  let repository: IotCalibrationRunRepository;
  let definitionRepository: IotCalibrationDefinitionRepository;
  let userId: string;
  let deviceId: string;
  let definitionId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Calibration Operator" });
    repository = testApp.module.get(IotCalibrationRunRepository);
    definitionRepository = testApp.module.get(IotCalibrationDefinitionRepository);

    const device = await testApp.createIotDevice({ createdBy: userId, deviceType: "minipar" });
    deviceId = device.id;

    const definition = await definitionRepository.create(
      {
        family: "minipar",
        name: `PAR calibration ${faker.string.uuid()}`,
        description: null,
        captureProcedure: PROCEDURE,
        script: "submit({})",
        outputSchema: { blocks: { par: { spec: { type: "number" } } } },
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

  const createComputedRun = async () => {
    const run = await repository.create({
      definitionId,
      deviceId,
      requestedBy: userId,
      inputSource: "bench_wizard",
      status: "running",
      payload: { par_sweep: [{ par_raw: 148.2 }] },
    });
    assertSuccess(run);
    const computed = await repository.saveResult(run.value.id, {
      status: "computed",
      blocks: BLOCKS,
    });
    assertSuccess(computed);
    return computed.value;
  };

  it("persists a run and joins the definition version", async () => {
    const run = await createComputedRun();

    expect(run.status).toBe("computed");
    expect(run.blocks).toEqual(BLOCKS);
    expect(run.definitionVersion).toBe(1);
    expect(run.finishedAt).not.toBeNull();

    const listed = await repository.listByDevice(deviceId);
    assertSuccess(listed);
    expect(listed.value.map((row) => row.id)).toContain(run.id);
  });

  it("approves a run and supersedes the previous active calibration", async () => {
    const first = await createComputedRun();
    const firstApproved = await repository.approve(first.id, deviceId, APPLIED, userId);
    assertSuccess(firstApproved);

    const second = await createComputedRun();
    const secondApproved = await repository.approve(second.id, deviceId, APPLIED, userId);
    assertSuccess(secondApproved);

    const active = await repository.findActiveByDevice(deviceId);
    assertSuccess(active);
    expect(active.value?.id).toBe(secondApproved.value.id);
    expect(active.value?.runId).toBe(second.id);

    const history = await repository.listCalibrationsByDevice(deviceId);
    assertSuccess(history);
    expect(history.value).toHaveLength(2);
    const superseded = history.value.find((row) => row.id === firstApproved.value.id);
    expect(superseded?.supersededAt).not.toBeNull();

    const approvedRun = await repository.findById(second.id);
    assertSuccess(approvedRun);
    expect(approvedRun.value?.status).toBe("approved");
    expect(approvedRun.value?.reviewedBy).toBe(userId);
  });

  it("rejects a computed run", async () => {
    const run = await createComputedRun();

    const rejected = await repository.reject(run.id, userId);
    assertSuccess(rejected);
    expect(rejected.value.status).toBe("rejected");

    const active = await repository.findActiveByDevice(deviceId);
    assertSuccess(active);
    expect(active.value).toBeNull();
  });

  // A partial session: the PAR gain fitted, the LED fit failed its gates, the
  // baseline was never attempted. The run is usable and only PAR is applied.
  it("keeps rejected and skipped blocks on the run while applying only computed ones", async () => {
    const run = await repository.create({
      definitionId,
      deviceId,
      requestedBy: userId,
      inputSource: "bench_wizard",
      status: "running",
    });
    assertSuccess(run);
    const partial = {
      par: { status: "computed" as const, coefficients: { spec: 1.19 } },
      led: { status: "rejected" as const, reason: "R-squared below 0.99" },
      baseline: { status: "skipped" as const, reason: "dark fixture not confirmed" },
    };
    const computed = await repository.saveResult(run.value.id, {
      status: "computed",
      blocks: partial,
    });
    assertSuccess(computed);
    expect(computed.value.blocks).toEqual(partial);

    const approved = await repository.approve(
      run.value.id,
      deviceId,
      { par: { coefficients: { spec: 1.19 } } },
      userId,
    );
    assertSuccess(approved);
    expect(Object.keys(approved.value.blocks)).toEqual(["par"]);

    const stored = await repository.findById(run.value.id);
    assertSuccess(stored);
    expect(stored.value?.blocks).toEqual(partial);
  });

  it("records the device write-back on the applied row", async () => {
    const run = await createComputedRun();
    const approved = await repository.approve(run.id, deviceId, APPLIED, userId);
    assertSuccess(approved);
    expect(approved.value.writtenToDeviceAt).toBeNull();
    expect(approved.value.writeResults).toBeNull();

    const written = await repository.markWritten(
      approved.value.id,
      { par: { verified: true } },
      { helloReply: "cal_par_slope=1.19" },
    );
    assertSuccess(written);
    expect(written.value.writtenToDeviceAt).not.toBeNull();
    expect(written.value.writeResults).toEqual({ par: { verified: true } });

    const stored = await repository.findById(run.id);
    assertSuccess(stored);
    expect(stored.value?.postInfo).toEqual({ helloReply: "cal_par_slope=1.19" });
  });
});
