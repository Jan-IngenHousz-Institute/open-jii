import { notifications } from "@repo/database";

import { assertFailure, assertSuccess, AppError, failure } from "../../../../common/utils/fp-utils";
import { NotificationRepository } from "../../../../notifications/core/repositories/notification.repository";
import { SharingRepository } from "../../../../sharing/core/repositories/sharing.repository";
import {
  audienceDeliveries,
  audienceNotifications,
  deliveriesFor,
  grantResourceAudience,
  heardByAllButTheActor,
  notificationsFor,
  seedResourceAudience,
} from "../../../../test/resource-audience";
import type { ResourceAudience } from "../../../../test/resource-audience";
import { TestHarness } from "../../../../test/test-harness";
import type { CreateMacroDto } from "../../../core/models/macro.model";
import { MacroRepository } from "../../../core/repositories/macro.repository";
import { DeleteMacroUseCase } from "./delete-macro";

describe("DeleteMacroUseCase", () => {
  const testApp = TestHarness.App;
  let testUserId: string;
  let useCase: DeleteMacroUseCase;
  let macroRepository: MacroRepository;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({});
    useCase = testApp.module.get(DeleteMacroUseCase);
    macroRepository = testApp.module.get(MacroRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("should delete a macro by id", async () => {
    const macroData: CreateMacroDto = {
      name: "Macro to Delete",
      description: "This macro will be deleted",
      language: "python",
      code: "cHl0aG9uIGNvZGU=",
    };

    const createResult = await macroRepository.create(macroData, testUserId);
    assertSuccess(createResult);
    const createdMacro = createResult.value[0];

    const result = await useCase.execute(createdMacro.id, testUserId);

    expect(result.isSuccess()).toBe(true);
    assertSuccess(result);

    const findResult = await macroRepository.findById(createdMacro.id);
    assertSuccess(findResult);
    expect(findResult.value).toBeNull();
  });

  it("should return error when deleting non-existent macro", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";

    const result = await useCase.execute(nonExistentId, testUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error).toMatchObject({
      code: "NOT_FOUND",
      message: "Macro not found",
      statusCode: 404,
    });
  });

  it("should return error when database deletion fails", async () => {
    const macroData: CreateMacroDto = {
      name: "Database Fail Macro",
      description: "Database deletion will fail",
      language: "javascript",
      code: "cHl0aG9uIGNvZGU=",
    };

    const createResult = await macroRepository.create(macroData, testUserId);
    assertSuccess(createResult);
    const createdMacro = createResult.value[0];

    vi.spyOn(macroRepository, "delete").mockResolvedValue(
      failure(AppError.internal("Database deletion failed")),
    );

    const result = await useCase.execute(createdMacro.id, testUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
    expect(result.error.message).toBe("Database deletion failed");
  });

  it("should handle invalid UUID format", async () => {
    const invalidId = "invalid-uuid-format";

    const result = await useCase.execute(invalidId, testUserId);

    expect(result.isSuccess()).toBe(false);
    assertFailure(result);
  });

  describe("notifying everyone with access", () => {
    let audience: ResourceAudience;
    let macroId: string;

    beforeEach(async () => {
      audience = await seedResourceAudience(testApp);
      macroId = (
        await testApp.createMacro({
          name: "Leaf Spectra",
          createdBy: audience.owner,
          organizationId: audience.organizationId,
        })
      ).id;
      await grantResourceAudience(testApp, audience, "macro", macroId);
    });

    it("tells the grantees and the owner, not the deleter, and queues their emails", async () => {
      assertSuccess(await useCase.execute(macroId, audience.actor));

      expect(await audienceNotifications(testApp, audience)).toEqual(
        heardByAllButTheActor(audience, (recipientId) => ({
          type: "resource_deleted",
          recipientId,
          actorId: audience.actor,
          resourceType: "macro",
          resourceId: macroId,
          params: { resourceName: "Leaf Spectra" },
        })),
      );
      expect(await audienceDeliveries(testApp, audience)).toEqual(
        heardByAllButTheActor(audience, () => ({ type: "resource_deleted", status: "pending" })),
      );
    });

    it("stores the row but queues no email for a viewer who switched the category off", async () => {
      assertSuccess(
        await testApp.module
          .get(NotificationRepository)
          .upsertPreference(audience.viewer, "experiments_and_resources", "email", false),
      );

      assertSuccess(await useCase.execute(macroId, audience.actor));

      expect(await notificationsFor(testApp, audience.viewer)).toHaveLength(1);
      expect(await deliveriesFor(testApp, audience.viewer)).toEqual([]);
    });

    it("tells nobody reached only through an organization role or a team", async () => {
      const orgAdmin = await testApp.createTestUser({ name: "Org Admin" });
      await testApp.addOrganizationMember(audience.organizationId, orgAdmin, "admin");
      const team = await testApp.createTeam(audience.organizationId);
      const teamMember = await testApp.createTestUser({ name: "Team Member" });
      await testApp.addTeamMember(team, teamMember);
      await testApp.addResourceGrant({
        resourceType: "macro",
        resourceId: macroId,
        granteeType: "team",
        granteeId: team,
        role: "viewer",
      });

      assertSuccess(await useCase.execute(macroId, audience.actor));

      expect(await notificationsFor(testApp, orgAdmin)).toEqual([]);
      expect(await notificationsFor(testApp, teamMember)).toEqual([]);
    });

    it("writes nothing for a macro that does not exist", async () => {
      assertFailure(await useCase.execute(crypto.randomUUID(), audience.actor));

      expect(await testApp.database.select().from(notifications)).toEqual([]);
    });

    it("writes nothing when the delete fails", async () => {
      vi.spyOn(macroRepository, "delete").mockResolvedValue(
        failure(AppError.internal("Database deletion failed")),
      );

      assertFailure(await useCase.execute(macroId, audience.actor));

      expect(await testApp.database.select().from(notifications)).toEqual([]);
    });

    it("still deletes when the notification cannot be stored", async () => {
      vi.spyOn(testApp.module.get(NotificationRepository), "insertMany").mockResolvedValue(
        failure(AppError.internal("notifications unavailable")),
      );

      assertSuccess(await useCase.execute(macroId, audience.actor));

      const found = await macroRepository.findById(macroId);
      assertSuccess(found);
      expect(found.value).toBeNull();
      expect(await testApp.database.select().from(notifications)).toEqual([]);
    });

    it("still deletes, telling nobody, when the members cannot be read", async () => {
      vi.spyOn(testApp.module.get(SharingRepository), "listMemberIds").mockResolvedValue(
        failure(AppError.internal("members unavailable")),
      );

      assertSuccess(await useCase.execute(macroId, audience.actor));

      const found = await macroRepository.findById(macroId);
      assertSuccess(found);
      expect(found.value).toBeNull();
      expect(await testApp.database.select().from(notifications)).toEqual([]);
    });
  });

  // Authorization (creator/org/grant checks) now lives in the @CanAccess route
  // guard and is covered by authorization.service.spec + the guard spec; the
  // use-case itself is pure business logic.
});
