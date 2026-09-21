import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import { and, eq, resourceGrants } from "@repo/database";

import { assertFailure, assertSuccess } from "../../../../common/utils/fp-utils";
import { TestHarness } from "../../../../test/test-harness";
import { IotCalibrationDefinitionRepository } from "../../../core/repositories/iot-calibration-definition.repository";
import { IotCalibrationRunRepository } from "../../../core/repositories/iot-calibration-run.repository";
import { DeleteCalibrationDefinitionUseCase } from "./delete-calibration-definition";

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

describe("DeleteCalibrationDefinitionUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: DeleteCalibrationDefinitionUseCase;
  let definitionRepository: IotCalibrationDefinitionRepository;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({ name: "Calibration Author" });
    useCase = testApp.module.get(DeleteCalibrationDefinitionUseCase);
    definitionRepository = testApp.module.get(IotCalibrationDefinitionRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const createDefinition = async () => {
    const definition = await definitionRepository.create(
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
    return definition.value[0].id;
  };

  it("deletes an unused definition version", async () => {
    const definitionId = await createDefinition();

    const result = await useCase.execute(definitionId, userId);
    assertSuccess(result);

    const found = await definitionRepository.findById(definitionId);
    assertSuccess(found);
    expect(found.value).toBeNull();
  });

  // A definition is staffed like every shared resource: creating one seeds the creator's
  // grant, so deleting one has to take the grants with it or they outlive the row.
  it("takes the definition's grants with it", async () => {
    const definitionId = await createDefinition();
    const grantsFor = () =>
      testApp.database
        .select({ id: resourceGrants.id })
        .from(resourceGrants)
        .where(
          and(
            eq(resourceGrants.resourceType, "calibration_definition"),
            eq(resourceGrants.resourceId, definitionId),
          ),
        );
    expect(await grantsFor()).not.toHaveLength(0);

    const result = await useCase.execute(definitionId, userId);

    assertSuccess(result);
    expect(await grantsFor()).toHaveLength(0);
  });

  it("reports a missing definition rather than succeeding silently", async () => {
    const result = await useCase.execute(crypto.randomUUID(), userId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  /**
   * Runs are the audit trail of what produced a coefficient, so the FK is
   * RESTRICT and a used version cannot vanish. The refusal has to name the
   * reason rather than surfacing Postgres's own wording.
   */
  it("refuses to delete a version that has runs", async () => {
    const definitionId = await createDefinition();
    const device = await testApp.createIotDevice({ createdBy: userId, deviceType: "minipar" });

    const run = await testApp.module.get(IotCalibrationRunRepository).create({
      definitionId,
      deviceId: device.id,
      requestedBy: userId,
      inputSource: "bench_wizard",
      status: "running",
    });
    assertSuccess(run);

    const result = await useCase.execute(definitionId, userId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(400);
    expect(result.error.message).toContain("has runs and cannot be deleted");
  });
});
