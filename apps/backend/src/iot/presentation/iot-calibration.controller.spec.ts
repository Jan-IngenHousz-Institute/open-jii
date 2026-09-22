import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import type {
  CalibrationDefinition,
  CalibrationDefinitionSummary,
} from "@repo/api/domains/iot/calibration/iot-calibration.schema";
import { calibrationDefinitions, eq } from "@repo/database";

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

describe("IotCalibrationController", () => {
  const testApp = TestHarness.App;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup({ mock: { AnalyticsAdapter: true } });
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Bench Operator" });
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

  describe("calibration definitions", () => {
    it("creates a definition (201)", async () => {
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

    // The response is what the author's page adopts, so a shape the contract refuses
    // reads to them as a save that failed, with the change already written.
    it("returns the edited definition in the shape the contract declares (200)", async () => {
      const created = await createDefinition();
      const rig: CaptureProcedure = {
        ...PROCEDURE,
        instruments: [{ role: "dut" }, { role: "lamp", handshake: "KIPRIM", model: "kiprim-dc" }],
        steps: [{ kind: "set", instrument: "lamp", set: "current_a", value: 0 }],
      };

      const response: SuperTestResponse<CalibrationDefinition> = await testApp
        .patch(
          testApp.resolveOrpcPath(contract.iot.updateCalibrationDefinition, {
            definitionId: created.body.id,
          }),
        )
        .withAuth(userId)
        .send({ captureProcedure: rig, family: "ambit" })
        .expect(StatusCodes.OK);

      expect(response.body.captureProcedure).toEqual(rig);
      expect(response.body.family).toBe("ambit");
      expect(typeof response.body.updatedAt).toBe("string");
    });

    describe("publishing", () => {
      const visibilityPath = (definitionId: string) =>
        testApp.resolveOrpcPath(contract.iot.setCalibrationDefinitionVisibility, { definitionId });

      it("publishes a private definition and returns its new visibility (200)", async () => {
        const created = await createDefinition();
        await testApp.database
          .update(calibrationDefinitions)
          .set({ visibility: "private" })
          .where(eq(calibrationDefinitions.id, created.body.id));

        const response = await testApp
          .patch(visibilityPath(created.body.id))
          .withAuth(userId)
          .send({ visibility: "public" })
          .expect(StatusCodes.OK);

        expect(response.body).toEqual({ id: created.body.id, visibility: "public" });
      });

      // Publishing is one way: a method other labs may already have copied cannot be
      // taken back by making the row private again.
      it("refuses to take a public definition back to private (400)", async () => {
        const created = await createDefinition();

        await testApp
          .patch(visibilityPath(created.body.id))
          .withAuth(userId)
          .send({ visibility: "private" })
          .expect(StatusCodes.BAD_REQUEST);
      });

      it("returns 403 to someone who cannot manage it", async () => {
        const created = await createDefinition();
        const outsider = await testApp.createTestUser({ name: "Otto Outsider" });

        await testApp
          .patch(visibilityPath(created.body.id))
          .withAuth(outsider)
          .send({ visibility: "public" })
          .expect(StatusCodes.FORBIDDEN);
      });
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
});
