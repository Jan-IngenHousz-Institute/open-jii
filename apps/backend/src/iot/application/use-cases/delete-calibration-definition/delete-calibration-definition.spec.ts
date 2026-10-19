import type { CaptureProcedure } from "@repo/api/domains/iot/calibration/iot-calibration-procedure.schema";
import {
  and,
  calibrationDefinitions,
  eq,
  notifications,
  resourceGrants,
  upsertGrant,
} from "@repo/database";

import { AppError, assertFailure, assertSuccess, failure } from "../../../../common/utils/fp-utils";
import { NotificationRepository } from "../../../../notifications/core/repositories/notification.repository";
import { SharingRepository } from "../../../../sharing/core/repositories/sharing.repository";
import {
  audienceDeliveries,
  audienceNotifications,
  grantResourceAudience,
  heardByAllButTheActor,
  seedResourceAudience,
} from "../../../../test/resource-audience";
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

  // A definition is shared like every staffed resource, and its grants have no cascade of
  // their own: deleting the row without them leaves grants pointing at nothing.
  it("takes the definition's grants with it", async () => {
    const definitionId = await createDefinition();
    const collaborator = await testApp.createTestUser({ name: "Casey Collaborator" });
    await upsertGrant(testApp.database, {
      resourceType: "calibration_definition",
      resourceId: definitionId,
      granteeType: "user",
      granteeId: collaborator,
      role: "viewer",
      createdBy: userId,
    });
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

  /** One calibration definition in an organization, shared with an admin and a viewer. */
  async function sharedDefinition() {
    const audience = await seedResourceAudience(testApp);
    const resourceId = (
      await testApp.createCalibrationDefinition({
        name: "PAR Baseline",
        createdBy: audience.owner,
        organizationId: audience.organizationId,
      })
    ).id;
    await grantResourceAudience(testApp, audience, "calibration_definition", resourceId);
    return { audience, resourceId };
  }

  it("tells the grantees and the owner, not the deleter, and queues their emails", async () => {
    const { audience, resourceId } = await sharedDefinition();

    assertSuccess(await useCase.execute(resourceId, audience.actor));

    expect(await audienceNotifications(testApp, audience)).toEqual(
      heardByAllButTheActor(audience, (recipientId) => ({
        type: "resource_deleted",
        recipientId,
        actorId: audience.actor,
        resourceType: "calibration_definition",
        resourceId,
        params: { resourceName: "PAR Baseline" },
      })),
    );
    expect(await audienceDeliveries(testApp, audience)).toEqual(
      heardByAllButTheActor(audience, () => ({ type: "resource_deleted", status: "pending" })),
    );
  });

  it("still deletes, telling nobody, when the members cannot be read", async () => {
    const { audience, resourceId } = await sharedDefinition();
    vi.spyOn(testApp.module.get(SharingRepository), "listMemberIds").mockResolvedValue(
      failure(AppError.internal("members unavailable")),
    );

    assertSuccess(await useCase.execute(resourceId, audience.actor));

    expect(
      await testApp.database
        .select()
        .from(calibrationDefinitions)
        .where(eq(calibrationDefinitions.id, resourceId)),
    ).toEqual([]);
    expect(await testApp.database.select().from(notifications)).toEqual([]);
  });

  it("still deletes, telling nobody, when the resource cannot be named", async () => {
    const { audience, resourceId } = await sharedDefinition();
    vi.spyOn(testApp.module.get(SharingRepository), "findResourceName").mockResolvedValue(
      failure(AppError.internal("names unavailable")),
    );

    assertSuccess(await useCase.execute(resourceId, audience.actor));

    expect(
      await testApp.database
        .select()
        .from(calibrationDefinitions)
        .where(eq(calibrationDefinitions.id, resourceId)),
    ).toEqual([]);
    expect(await testApp.database.select().from(notifications)).toEqual([]);
  });

  it("still deletes when the notification cannot be stored", async () => {
    const { audience, resourceId } = await sharedDefinition();
    vi.spyOn(testApp.module.get(NotificationRepository), "insertMany").mockResolvedValue(
      failure(AppError.internal("notifications unavailable")),
    );

    assertSuccess(await useCase.execute(resourceId, audience.actor));

    expect(
      await testApp.database
        .select()
        .from(calibrationDefinitions)
        .where(eq(calibrationDefinitions.id, resourceId)),
    ).toEqual([]);
    expect(await testApp.database.select().from(notifications)).toEqual([]);
  });
});
