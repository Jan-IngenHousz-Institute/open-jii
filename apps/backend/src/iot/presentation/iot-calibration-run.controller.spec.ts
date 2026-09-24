import { StatusCodes } from "http-status-codes";

import { FEATURE_FLAGS } from "@repo/analytics";
import { contract } from "@repo/api/contract";
import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import type {
  CalibrationDefinition,
  CalibrationRun,
  CalibrationRunDetail,
  ActiveDeviceCalibration,
  DeviceCalibration,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";

import { AnalyticsAdapter } from "../../common/modules/analytics/analytics.adapter";
import { AwsAdapter } from "../../common/modules/aws/aws.adapter";
import { success } from "../../common/utils/fp-utils";
import type { MockAnalyticsAdapter } from "../../test/mocks/adapters/analytics.adapter.mock";
import { TestHarness } from "../../test/test-harness";
import type { SuperTestResponse } from "../../test/test-harness";

const PROCEDURE: CaptureProcedure = {
  instruments: [{ role: "dut" }],
  steps: [
    {
      kind: "read",
      series: "par_sweep",
      read: [{ instrument: "dut", command: "par_raw", as: "par_raw" }],
    },
  ],
  verify: [
    {
      kind: "read",
      series: "par_check",
      read: [{ instrument: "dut", command: "par", as: "par" }],
    },
  ],
};

const DEFINITION_BODY = {
  family: "minipar",
  name: "PAR bench calibration",
  captureProcedure: PROCEDURE,
  script: "submit({})",
  outputSchema: { blocks: { par: { spec: { type: "number" } } } },
};

const PAYLOAD = { par_sweep: [{ par_raw: 148.2 }] };

const COMPUTED = {
  status: "computed",
  blocks: { par: { status: "computed", coefficients: { spec: 1.19 } } },
};

describe("IotCalibrationRunController", () => {
  const testApp = TestHarness.App;
  let userId: string;
  let deviceId: string;
  let analyticsAdapter: MockAnalyticsAdapter;

  beforeAll(async () => {
    await testApp.setup({ mock: { AnalyticsAdapter: true } });
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Bench Operator" });
    analyticsAdapter = testApp.module.get(AnalyticsAdapter);
    analyticsAdapter.setFlag(FEATURE_FLAGS.CALIBRATION, true);
    const awsAdapter = testApp.module.get(AwsAdapter);
    vi.spyOn(awsAdapter, "getCalibrationSandboxFunctionName").mockReturnValue("test-calibration");
    vi.spyOn(awsAdapter, "invokeLambda").mockResolvedValue(
      success({ statusCode: 200, payload: COMPUTED }),
    );

    const device = await testApp.createIotDevice({ createdBy: userId, deviceType: "minipar" });
    deviceId = device.id;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  async function createDefinition(
    body: object = DEFINITION_BODY,
  ): Promise<SuperTestResponse<CalibrationDefinition>> {
    return testApp
      .post(testApp.resolveOrpcPath(contract.iot.createCalibrationDefinition))
      .withAuth(userId)
      .send(body)
      .expect(StatusCodes.CREATED);
  }

  async function createRun(definitionId: string): Promise<SuperTestResponse<CalibrationRun>> {
    return testApp
      .post(testApp.resolveOrpcPath(contract.iot.createCalibrationRun, { deviceId }))
      .withAuth(userId)
      .send({ definitionId, payload: PAYLOAD, preInfo: { helloReply: "MiniPAR 1.03" } })
      .expect(StatusCodes.CREATED);
  }

  async function approveRun(runId: string): Promise<SuperTestResponse<DeviceCalibration>> {
    return testApp
      .post(testApp.resolveOrpcPath(contract.iot.approveCalibrationRun, { runId }))
      .withAuth(userId)
      .send({})
      .expect(StatusCodes.CREATED);
  }
  describe("calibration runs", () => {
    let definitionId: string;

    beforeEach(async () => {
      definitionId = (await createDefinition()).body.id;
    });

    it("records a computed run for the device (201)", async () => {
      const response = await createRun(definitionId);

      expect(response.body.status).toBe("computed");
      expect(response.body.deviceId).toBe(deviceId);
      expect(response.body.definitionVersion).toBe(1);
      expect(response.body.preInfo).toEqual({ helloReply: "MiniPAR 1.03" });
      expect(response.body.blocks).toEqual(COMPUTED.blocks);
    });

    it("returns 400 when the payload misses a required series", async () => {
      await testApp
        .post(testApp.resolveOrpcPath(contract.iot.createCalibrationRun, { deviceId }))
        .withAuth(userId)
        .send({ definitionId, payload: {} })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("returns 403 for a run on another user's private device", async () => {
      const outsider = await testApp.createTestUser({ name: "Otto Outsider" });

      await testApp
        .post(testApp.resolveOrpcPath(contract.iot.createCalibrationRun, { deviceId }))
        .withAuth(outsider)
        .send({ definitionId, payload: PAYLOAD })
        .expect(StatusCodes.FORBIDDEN);
    });

    // An external bench brings its own blocks; the platform records them
    // without invoking the script.
    it("records an externally computed run (201)", async () => {
      const response: SuperTestResponse<CalibrationRun> = await testApp
        .post(testApp.resolveOrpcPath(contract.iot.createExternalCalibrationRun, { deviceId }))
        .withAuth(userId)
        .send({ definitionId, blocks: COMPUTED.blocks, postInfo: { helloReply: "done" } })
        .expect(StatusCodes.CREATED);

      expect(response.body.inputSource).toBe("external_bench");
      expect(response.body.status).toBe("computed");
      expect(response.body.postInfo).toEqual({ helloReply: "done" });
    });

    it("returns 400 for external blocks the schema does not declare", async () => {
      await testApp
        .post(testApp.resolveOrpcPath(contract.iot.createExternalCalibrationRun, { deviceId }))
        .withAuth(userId)
        .send({
          definitionId,
          blocks: { led: { status: "computed", coefficients: { act: 1 } } },
        })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("returns 404 for a run nobody recorded", async () => {
      const runId = crypto.randomUUID();

      await testApp
        .get(testApp.resolveOrpcPath(contract.iot.getCalibrationRun, { runId }))
        .withAuth(userId)
        .expect(StatusCodes.NOT_FOUND);
      await testApp
        .post(testApp.resolveOrpcPath(contract.iot.approveCalibrationRun, { runId }))
        .withAuth(userId)
        .send({})
        .expect(StatusCodes.NOT_FOUND);
      await testApp
        .post(testApp.resolveOrpcPath(contract.iot.rejectCalibrationRun, { runId }))
        .withAuth(userId)
        .send({})
        .expect(StatusCodes.NOT_FOUND);
    });

    it("lists and fetches the device's runs (200)", async () => {
      const created = await createRun(definitionId);

      const list: SuperTestResponse<CalibrationRun[]> = await testApp
        .get(testApp.resolveOrpcPath(contract.iot.listDeviceCalibrationRuns, { deviceId }))
        .withAuth(userId)
        .expect(StatusCodes.OK);
      expect(list.body.map((run) => run.id)).toEqual([created.body.id]);

      const single: SuperTestResponse<CalibrationRunDetail> = await testApp
        .get(testApp.resolveOrpcPath(contract.iot.getCalibrationRun, { runId: created.body.id }))
        .withAuth(userId)
        .expect(StatusCodes.OK);
      expect(single.body.id).toBe(created.body.id);

      // The readings a fit was computed from are what lets anyone re-derive or argue with
      // it later, so one run carries them. The list is read on every device page and does
      // not.
      expect(single.body.payload).toEqual(PAYLOAD);
      expect(list.body[0]).not.toHaveProperty("payload");
    });

    it("approves a run into the device's active calibration (201)", async () => {
      const run = await createRun(definitionId);

      const applied = await approveRun(run.body.id);
      expect(applied.body.runId).toBe(run.body.id);
      expect(applied.body.blocks).toEqual({ par: { coefficients: { spec: 1.19 } } });

      // What is in force is composed per block, so it names the approval each one came
      // from rather than being one approval itself.
      const active: SuperTestResponse<ActiveDeviceCalibration | null> = await testApp
        .get(testApp.resolveOrpcPath(contract.iot.getActiveDeviceCalibration, { deviceId }))
        .withAuth(userId)
        .expect(StatusCodes.OK);
      expect(active.body?.blocks.par.calibrationId).toBe(applied.body.id);
      expect(active.body?.blocks.par.coefficients).toEqual({ spec: 1.19 });

      const history: SuperTestResponse<DeviceCalibration[]> = await testApp
        .get(testApp.resolveOrpcPath(contract.iot.listDeviceCalibrations, { deviceId }))
        .withAuth(userId)
        .expect(StatusCodes.OK);
      expect(history.body.map((row) => row.id)).toEqual([applied.body.id]);
    });

    it("reports no active calibration before any approval (200)", async () => {
      const active: SuperTestResponse<DeviceCalibration | null> = await testApp
        .get(testApp.resolveOrpcPath(contract.iot.getActiveDeviceCalibration, { deviceId }))
        .withAuth(userId)
        .expect(StatusCodes.OK);

      expect(active.body).toBeNull();
    });

    it("rejects a run (200)", async () => {
      const run = await createRun(definitionId);

      const response: SuperTestResponse<CalibrationRun> = await testApp
        .post(testApp.resolveOrpcPath(contract.iot.rejectCalibrationRun, { runId: run.body.id }))
        .withAuth(userId)
        .send({})
        .expect(StatusCodes.OK);

      expect(response.body.status).toBe("rejected");
      expect(response.body.reviewedBy).toBe(userId);
    });

    it("records the device write and the post-write state (200)", async () => {
      const run = await createRun(definitionId);
      const applied = await approveRun(run.body.id);

      const response: SuperTestResponse<DeviceCalibration> = await testApp
        .post(
          testApp.resolveOrpcPath(contract.iot.reportDeviceCalibrationWrite, {
            calibrationId: applied.body.id,
          }),
        )
        .withAuth(userId)
        .send({
          writeResults: { par: { verified: true } },
          postInfo: { helloReply: "MiniPAR 1.03 cal_par_slope=1.19" },
          verification: { par_check: [{ par: 402.9 }] },
        })
        .expect(StatusCodes.OK);

      expect(response.body.writtenToDeviceAt).not.toBeNull();
      expect(response.body.writeResults).toEqual({ par: { verified: true } });
      expect(response.body.verification).toEqual({ par_check: [{ par: 402.9 }] });

      const stored: SuperTestResponse<CalibrationRun> = await testApp
        .get(testApp.resolveOrpcPath(contract.iot.getCalibrationRun, { runId: run.body.id }))
        .withAuth(userId)
        .expect(StatusCodes.OK);
      expect(stored.body.postInfo).toEqual({ helloReply: "MiniPAR 1.03 cal_par_slope=1.19" });
    });

    it("returns 400 for a verification naming a series the verify phase does not produce", async () => {
      const run = await createRun(definitionId);
      const applied = await approveRun(run.body.id);

      await testApp
        .post(
          testApp.resolveOrpcPath(contract.iot.reportDeviceCalibrationWrite, {
            calibrationId: applied.body.id,
          }),
        )
        .withAuth(userId)
        .send({
          writeResults: { par: { verified: true } },
          verification: { par_sweep: [{ par_raw: 1 }] },
        })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("returns 400 for a write naming a block the calibration did not apply", async () => {
      const run = await createRun(definitionId);
      const applied = await approveRun(run.body.id);

      await testApp
        .post(
          testApp.resolveOrpcPath(contract.iot.reportDeviceCalibrationWrite, {
            calibrationId: applied.body.id,
          }),
        )
        .withAuth(userId)
        .send({ writeResults: { led: { verified: true } } })
        .expect(StatusCodes.BAD_REQUEST);
    });
  });

  // Hidden until PostHog targets someone: the gate sits in front of every handler, so a
  // caller who can reach the device still gets nothing from its calibration.
  describe("while calibration is flagged off", () => {
    it("refuses every run and device calibration endpoint (403)", async () => {
      const definitionId = (await createDefinition()).body.id;
      const approved = await createRun(definitionId);
      const applied = await approveRun(approved.body.id);
      const pending = await createRun(definitionId);
      analyticsAdapter.setFlag(FEATURE_FLAGS.CALIBRATION, false);

      const endpoints = [
        {
          name: "createCalibrationRun",
          call: () =>
            testApp
              .post(testApp.resolveOrpcPath(contract.iot.createCalibrationRun, { deviceId }))
              .withAuth(userId)
              .send({ definitionId, payload: PAYLOAD }),
        },
        {
          name: "createExternalCalibrationRun",
          call: () =>
            testApp
              .post(
                testApp.resolveOrpcPath(contract.iot.createExternalCalibrationRun, { deviceId }),
              )
              .withAuth(userId)
              .send({ definitionId, blocks: COMPUTED.blocks }),
        },
        {
          name: "listDeviceCalibrationRuns",
          call: () =>
            testApp
              .get(testApp.resolveOrpcPath(contract.iot.listDeviceCalibrationRuns, { deviceId }))
              .withAuth(userId),
        },
        {
          name: "getCalibrationRun",
          call: () =>
            testApp
              .get(
                testApp.resolveOrpcPath(contract.iot.getCalibrationRun, {
                  runId: approved.body.id,
                }),
              )
              .withAuth(userId),
        },
        {
          name: "approveCalibrationRun",
          call: () =>
            testApp
              .post(
                testApp.resolveOrpcPath(contract.iot.approveCalibrationRun, {
                  runId: pending.body.id,
                }),
              )
              .withAuth(userId)
              .send({}),
        },
        {
          name: "rejectCalibrationRun",
          call: () =>
            testApp
              .post(
                testApp.resolveOrpcPath(contract.iot.rejectCalibrationRun, {
                  runId: pending.body.id,
                }),
              )
              .withAuth(userId)
              .send({}),
        },
        {
          name: "getActiveDeviceCalibration",
          call: () =>
            testApp
              .get(testApp.resolveOrpcPath(contract.iot.getActiveDeviceCalibration, { deviceId }))
              .withAuth(userId),
        },
        {
          name: "listDeviceCalibrations",
          call: () =>
            testApp
              .get(testApp.resolveOrpcPath(contract.iot.listDeviceCalibrations, { deviceId }))
              .withAuth(userId),
        },
        {
          name: "reportDeviceCalibrationWrite",
          call: () =>
            testApp
              .post(
                testApp.resolveOrpcPath(contract.iot.reportDeviceCalibrationWrite, {
                  calibrationId: applied.body.id,
                }),
              )
              .withAuth(userId)
              .send({ writeResults: { par: { verified: true } } }),
        },
      ];

      for (const endpoint of endpoints) {
        const response = await endpoint.call();
        expect({ endpoint: endpoint.name, status: response.status }).toEqual({
          endpoint: endpoint.name,
          status: StatusCodes.FORBIDDEN,
        });
      }
    });
  });
});
