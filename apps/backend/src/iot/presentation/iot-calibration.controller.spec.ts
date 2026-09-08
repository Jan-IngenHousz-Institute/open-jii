import { StatusCodes } from "http-status-codes";

import { FEATURE_FLAGS } from "@repo/analytics";
import { contract } from "@repo/api/contract";
import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import type {
  CalibrationDefinition,
  CalibrationDefinitionSummary,
  CalibrationRun,
  DeviceCalibration,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { calibrationDefinitions, eq } from "@repo/database";

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

describe("IotCalibrationController", () => {
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
    analyticsAdapter.setFlag(FEATURE_FLAGS.IOT_DEVICES, true);
    vi.spyOn(testApp.module.get(AwsAdapter), "invokeCalibrationSandbox").mockResolvedValue(
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

  describe("iot-devices feature flag", () => {
    it("returns 403 on every calibration endpoint when the flag is disabled", async () => {
      const definition = await createDefinition();
      const run = await createRun(definition.body.id);
      analyticsAdapter.setFlag(FEATURE_FLAGS.IOT_DEVICES, false);

      await testApp
        .get(testApp.resolveOrpcPath(contract.iot.listCalibrationDefinitions))
        .withAuth(userId)
        .expect(StatusCodes.FORBIDDEN);
      await testApp
        .post(testApp.resolveOrpcPath(contract.iot.createCalibrationDefinition))
        .withAuth(userId)
        .send(DEFINITION_BODY)
        .expect(StatusCodes.FORBIDDEN);
      await testApp
        .get(
          testApp.resolveOrpcPath(contract.iot.getCalibrationDefinition, {
            definitionId: definition.body.id,
          }),
        )
        .withAuth(userId)
        .expect(StatusCodes.FORBIDDEN);
      await testApp
        .delete(
          testApp.resolveOrpcPath(contract.iot.deleteCalibrationDefinition, {
            definitionId: definition.body.id,
          }),
        )
        .withAuth(userId)
        .expect(StatusCodes.FORBIDDEN);
      await testApp
        .post(testApp.resolveOrpcPath(contract.iot.createCalibrationRun, { deviceId }))
        .withAuth(userId)
        .send({ definitionId: definition.body.id, payload: PAYLOAD })
        .expect(StatusCodes.FORBIDDEN);
      await testApp
        .post(testApp.resolveOrpcPath(contract.iot.createExternalCalibrationRun, { deviceId }))
        .withAuth(userId)
        .send({ definitionId: definition.body.id, blocks: COMPUTED.blocks })
        .expect(StatusCodes.FORBIDDEN);
      await testApp
        .get(testApp.resolveOrpcPath(contract.iot.listDeviceCalibrationRuns, { deviceId }))
        .withAuth(userId)
        .expect(StatusCodes.FORBIDDEN);
      await testApp
        .get(testApp.resolveOrpcPath(contract.iot.getCalibrationRun, { runId: run.body.id }))
        .withAuth(userId)
        .expect(StatusCodes.FORBIDDEN);
      await testApp
        .post(testApp.resolveOrpcPath(contract.iot.approveCalibrationRun, { runId: run.body.id }))
        .withAuth(userId)
        .send({})
        .expect(StatusCodes.FORBIDDEN);
      await testApp
        .post(testApp.resolveOrpcPath(contract.iot.rejectCalibrationRun, { runId: run.body.id }))
        .withAuth(userId)
        .send({})
        .expect(StatusCodes.FORBIDDEN);
      await testApp
        .get(testApp.resolveOrpcPath(contract.iot.listDeviceCalibrations, { deviceId }))
        .withAuth(userId)
        .expect(StatusCodes.FORBIDDEN);
      await testApp
        .get(testApp.resolveOrpcPath(contract.iot.getActiveDeviceCalibration, { deviceId }))
        .withAuth(userId)
        .expect(StatusCodes.FORBIDDEN);
      await testApp
        .post(
          testApp.resolveOrpcPath(contract.iot.reportDeviceCalibrationWrite, {
            calibrationId: crypto.randomUUID(),
          }),
        )
        .withAuth(userId)
        .send({ writeResults: { par: { verified: true } } })
        .expect(StatusCodes.FORBIDDEN);
    });
  });

  describe("calibration definitions", () => {
    it("creates version 1 of a definition (201)", async () => {
      const response = await createDefinition();

      expect(response.body.version).toBe(1);
      expect(response.body.family).toBe("minipar");
      expect(response.body.script).toBe("submit({})");
    });

    it("returns 401 when unauthenticated", async () => {
      await testApp
        .post(testApp.resolveOrpcPath(contract.iot.createCalibrationDefinition))
        .withoutAuth()
        .send(DEFINITION_BODY)
        .expect(StatusCodes.UNAUTHORIZED);
    });

    it("returns 400 for a procedure the contract refuses", async () => {
      await testApp
        .post(testApp.resolveOrpcPath(contract.iot.createCalibrationDefinition))
        .withAuth(userId)
        .send({ ...DEFINITION_BODY, captureProcedure: { instruments: [], steps: [] } })
        .expect(StatusCodes.BAD_REQUEST);
    });

    // A line keeps its family for life; the platform refuses the version and
    // reports why rather than silently forking a second line.
    it("returns 400 for a version that would change the line's family", async () => {
      await createDefinition();

      await testApp
        .post(testApp.resolveOrpcPath(contract.iot.createCalibrationDefinition))
        .withAuth(userId)
        .send({ ...DEFINITION_BODY, family: "ambit" })
        .expect(StatusCodes.BAD_REQUEST);
    });

    it("returns 403 when creating in an organization the caller is not a member of", async () => {
      const organizationId = await testApp.createOrganization();

      await testApp
        .post(testApp.resolveOrpcPath(contract.iot.createCalibrationDefinition))
        .withAuth(userId)
        .send({ ...DEFINITION_BODY, organizationId })
        .expect(StatusCodes.FORBIDDEN);
    });

    // A listing is browsed by family; the script and schema only matter once
    // a definition is chosen, so they stay off the summary rows.
    it("lists summaries without the script (200)", async () => {
      await createDefinition();

      const response: SuperTestResponse<CalibrationDefinitionSummary[]> = await testApp
        .get(
          testApp.resolveOrpcPath(contract.iot.listCalibrationDefinitions, { family: "minipar" }),
        )
        .withAuth(userId)
        .expect(StatusCodes.OK);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe("PAR bench calibration");
      expect(response.body[0]).not.toHaveProperty("script");
    });

    it("returns the full definition to its author (200)", async () => {
      const created = await createDefinition();

      const response: SuperTestResponse<CalibrationDefinition> = await testApp
        .get(
          testApp.resolveOrpcPath(contract.iot.getCalibrationDefinition, {
            definitionId: created.body.id,
          }),
        )
        .withAuth(userId)
        .expect(StatusCodes.OK);

      expect(response.body.captureProcedure).toEqual(PROCEDURE);
    });

    // A definition is a shared recipe, public unless its owner withdraws it.
    it("serves another user's definition while it is public, and 403 once private", async () => {
      const created = await createDefinition();
      const outsider = await testApp.createTestUser({ name: "Otto Outsider" });
      const path = testApp.resolveOrpcPath(contract.iot.getCalibrationDefinition, {
        definitionId: created.body.id,
      });

      await testApp.get(path).withAuth(outsider).expect(StatusCodes.OK);

      await testApp.database
        .update(calibrationDefinitions)
        .set({ visibility: "private" })
        .where(eq(calibrationDefinitions.id, created.body.id));
      await testApp.get(path).withAuth(outsider).expect(StatusCodes.FORBIDDEN);
    });

    it("deletes the author's definition (204)", async () => {
      const created = await createDefinition();

      await testApp
        .delete(
          testApp.resolveOrpcPath(contract.iot.deleteCalibrationDefinition, {
            definitionId: created.body.id,
          }),
        )
        .withAuth(userId)
        .expect(StatusCodes.NO_CONTENT);

      const response: SuperTestResponse<CalibrationDefinitionSummary[]> = await testApp
        .get(
          testApp.resolveOrpcPath(contract.iot.listCalibrationDefinitions, { family: "minipar" }),
        )
        .withAuth(userId)
        .expect(StatusCodes.OK);
      expect(response.body).toHaveLength(0);
    });

    it("returns 403 when deleting another user's definition", async () => {
      const created = await createDefinition();
      const outsider = await testApp.createTestUser({ name: "Otto Outsider" });

      await testApp
        .delete(
          testApp.resolveOrpcPath(contract.iot.deleteCalibrationDefinition, {
            definitionId: created.body.id,
          }),
        )
        .withAuth(outsider)
        .expect(StatusCodes.FORBIDDEN);
    });
  });

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

      const single: SuperTestResponse<CalibrationRun> = await testApp
        .get(testApp.resolveOrpcPath(contract.iot.getCalibrationRun, { runId: created.body.id }))
        .withAuth(userId)
        .expect(StatusCodes.OK);
      expect(single.body.id).toBe(created.body.id);
    });

    it("approves a run into the device's active calibration (201)", async () => {
      const run = await createRun(definitionId);

      const applied = await approveRun(run.body.id);
      expect(applied.body.runId).toBe(run.body.id);
      expect(applied.body.blocks).toEqual({ par: { coefficients: { spec: 1.19 } } });

      const active: SuperTestResponse<DeviceCalibration | null> = await testApp
        .get(testApp.resolveOrpcPath(contract.iot.getActiveDeviceCalibration, { deviceId }))
        .withAuth(userId)
        .expect(StatusCodes.OK);
      expect(active.body?.id).toBe(applied.body.id);

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
        })
        .expect(StatusCodes.OK);

      expect(response.body.writtenToDeviceAt).not.toBeNull();
      expect(response.body.writeResults).toEqual({ par: { verified: true } });

      const stored: SuperTestResponse<CalibrationRun> = await testApp
        .get(testApp.resolveOrpcPath(contract.iot.getCalibrationRun, { runId: run.body.id }))
        .withAuth(userId)
        .expect(StatusCodes.OK);
      expect(stored.body.postInfo).toEqual({ helloReply: "MiniPAR 1.03 cal_par_slope=1.19" });
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
});
