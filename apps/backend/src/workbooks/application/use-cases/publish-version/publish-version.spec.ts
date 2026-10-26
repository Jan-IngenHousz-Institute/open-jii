import { Logger } from "@nestjs/common";

import { eq, experiments } from "@repo/database";

import { assertFailure, assertSuccess, failure, AppError } from "../../../../common/utils/fp-utils";
import { AttachWorkbookUseCase } from "../../../../experiments/application/use-cases/attach-workbook/attach-workbook";
import { NotificationDispatchService } from "../../../../notifications/application/services/notification-dispatch.service";
import { NotificationRepository } from "../../../../notifications/core/repositories/notification.repository";
import { SharingRepository } from "../../../../sharing/core/repositories/sharing.repository";
import {
  audienceDeliveries,
  audienceNotifications,
  deliveriesFor,
  grantResourceAudience,
  notificationsFor,
  seedResourceAudience,
} from "../../../../test/resource-audience";
import type { ResourceAudience } from "../../../../test/resource-audience";
import { TestHarness } from "../../../../test/test-harness";
import { WorkbookVersionRepository } from "../../../core/repositories/workbook-version.repository";
import { WorkbookRepository } from "../../../core/repositories/workbook.repository";
import { PublishVersionUseCase } from "./publish-version";

describe("PublishVersionUseCase", () => {
  const testApp = TestHarness.App;
  let useCase: PublishVersionUseCase;
  let workbookRepo: WorkbookRepository;
  let versionRepo: WorkbookVersionRepository;
  let userId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    userId = await testApp.createTestUser({});
    useCase = testApp.module.get(PublishVersionUseCase);
    workbookRepo = testApp.module.get(WorkbookRepository);
    versionRepo = testApp.module.get(WorkbookVersionRepository);
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("creates version 1 for a workbook with no existing versions", async () => {
    const workbook = await testApp.createWorkbook({ name: "WB1", createdBy: userId });

    const result = await useCase.execute(workbook.id, userId);
    assertSuccess(result);
    expect(result.value.version).toBe(1);
    expect(result.value.workbookId).toBe(workbook.id);
    expect(result.value.createdBy).toBe(userId);
  });

  it("always mints a new version (no dedup) on successive calls", async () => {
    const workbook = await testApp.createWorkbook({
      name: "WB2",
      cells: [{ id: "md1", type: "markdown", content: "Hello", isCollapsed: false }],
      createdBy: userId,
    });

    const v1 = await useCase.execute(workbook.id, userId);
    assertSuccess(v1);
    expect(v1.value.version).toBe(1);

    const v2 = await useCase.execute(workbook.id, userId);
    assertSuccess(v2);
    expect(v2.value.version).toBe(2);
    expect(v2.value.id).not.toBe(v1.value.id);
  });

  it("increments to next version when cells have changed", async () => {
    const workbook = await testApp.createWorkbook({
      name: "WB3",
      cells: [{ id: "md1", type: "markdown", content: "v1", isCollapsed: false }],
      createdBy: userId,
    });

    const v1 = await useCase.execute(workbook.id, userId);
    assertSuccess(v1);

    await workbookRepo.update(workbook.id, {
      cells: [{ id: "md1", type: "markdown", content: "v2", isCollapsed: false }],
    });

    const v2 = await useCase.execute(workbook.id, userId);
    assertSuccess(v2);
    expect(v2.value.version).toBe(2);
  });

  it("returns failure when workbook does not exist", async () => {
    const result = await useCase.execute("00000000-0000-0000-0000-000000000000", userId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(404);
  });

  it("returns failure when workbook repo findById fails", async () => {
    vi.spyOn(workbookRepo, "findById").mockResolvedValue(failure(AppError.internal("DB error")));
    const result = await useCase.execute("00000000-0000-0000-0000-000000000000", userId);
    assertFailure(result);
    vi.restoreAllMocks();
  });

  it("returns failure when version repo create fails", async () => {
    const workbook = await testApp.createWorkbook({ name: "WBFail", createdBy: userId });
    vi.spyOn(versionRepo, "create").mockResolvedValue(failure(AppError.internal("DB error")));
    const result = await useCase.execute(workbook.id, userId);
    assertFailure(result);
    vi.restoreAllMocks();
  });

  it("fails closed when a referenced protocol is private and inaccessible to the publisher", async () => {
    // Referencing a private protocol's UUID must not let the publisher snapshot
    // (and later read) its code without access.
    const otherUser = await testApp.createTestUser({});
    const otherOrgId = await testApp.createOrganization();
    await testApp.addOrganizationMember(otherOrgId, otherUser, "owner");
    const privateProtocol = await testApp.createProtocol({
      name: `secret-protocol-${Math.random().toString(36).slice(2)}`,
      createdBy: otherUser,
      visibility: "private",
      organizationId: otherOrgId,
    });

    const workbook = await testApp.createWorkbook({
      name: "Exfil attempt",
      cells: [
        {
          id: "p1",
          type: "protocol",
          isCollapsed: false,
          payload: { protocolId: privateProtocol.id, version: 1 },
        },
      ],
      createdBy: userId,
    });

    const result = await useCase.execute(workbook.id, userId);
    assertFailure(result);
    expect(result.error.statusCode).toBe(403);
  });

  it("pins the macro language from the live row, not the cell payload", async () => {
    const macro = await testApp.createMacro({
      name: "Python macro",
      language: "python",
      code: btoa("# python"),
      createdBy: userId,
    });
    const workbook = await testApp.createWorkbook({
      name: "WBLang",
      cells: [
        {
          id: "m1",
          type: "macro",
          isCollapsed: false,
          payload: { macroId: macro.id, language: "javascript" },
        },
      ],
      createdBy: userId,
    });

    const result = await useCase.execute(workbook.id, userId);
    assertSuccess(result);
    expect(result.value.entitySnapshots.macros[macro.id]).toEqual({
      code: btoa("# python"),
      language: "python",
    });
  });

  it("snapshots the current cells of the workbook", async () => {
    const cells = [
      {
        id: "p1",
        type: "protocol",
        isCollapsed: false,
        payload: { protocolId: "11111111-1111-1111-1111-111111111111", version: 1 },
      },
    ];
    const workbook = await testApp.createWorkbook({
      name: "WBSnap",
      cells,
      createdBy: userId,
    });

    const result = await useCase.execute(workbook.id, userId);
    assertSuccess(result);
    expect(result.value.cells).toEqual(cells);
  });

  describe("telling the experiments on an older version", () => {
    let audience: ResourceAudience;
    let organizationAdmin: string;
    let adminOfA: string;
    let workbookId: string;
    let experimentA: string;
    let experimentB: string;

    const drift = (content: string) =>
      workbookRepo.update(workbookId, {
        cells: [{ id: "md1", type: "markdown", content, isCollapsed: false }],
      });

    const heardAbout = (recipientId: string, version: string) => ({
      type: "workbook_version_published",
      recipientId,
      actorId: audience.actor,
      resourceType: "experiment",
      resourceId: experimentB,
      params: { experimentName: "Experiment B", workbookName: "Shared workbook", version },
    });

    const createExperiment = async (name: string) => {
      const { experiment } = await testApp.createExperiment({
        name,
        userId: audience.actor,
        organizationId: audience.organizationId,
      });
      return experiment.id;
    };

    beforeEach(async () => {
      audience = await seedResourceAudience(testApp);
      organizationAdmin = await testApp.createTestUser({ name: "Org Admin" });
      await testApp.addOrganizationMember(audience.organizationId, organizationAdmin, "admin");
      adminOfA = await testApp.createTestUser({ name: "Admin of A" });

      workbookId = (
        await testApp.createWorkbook({
          name: "Shared workbook",
          cells: [{ id: "md1", type: "markdown", content: "v1", isCollapsed: false }],
          createdBy: audience.actor,
          organizationId: audience.organizationId,
        })
      ).id;
      await testApp.addResourceGrant({
        resourceType: "workbook",
        resourceId: workbookId,
        granteeType: "user",
        granteeId: audience.actor,
        role: "admin",
      });

      experimentA = await createExperiment("Experiment A");
      experimentB = await createExperiment("Experiment B");
      for (const granteeId of [audience.actor, adminOfA]) {
        await testApp.addResourceGrant({
          resourceType: "experiment",
          resourceId: experimentA,
          granteeType: "user",
          granteeId,
          role: "admin",
        });
      }
      await grantResourceAudience(testApp, audience, "experiment", experimentB);

      const attach = testApp.module.get(AttachWorkbookUseCase);
      assertSuccess(await attach.execute(experimentA, workbookId, audience.actor));
      assertSuccess(await attach.execute(experimentB, workbookId, audience.actor));
    });

    it("tells the admins of the other experiment once each, and nobody else", async () => {
      await drift("v2");

      const result = await useCase.execute(workbookId, audience.actor, {
        forExperimentId: experimentA,
      });

      assertSuccess(result);
      expect(result.value.version).toBe(2);
      expect(await audienceNotifications(testApp, audience)).toEqual({
        owner: [heardAbout(audience.owner, "2")],
        actor: [],
        admin: [heardAbout(audience.admin, "2")],
        viewer: [],
      });
      expect(await notificationsFor(testApp, organizationAdmin)).toEqual([]);
      expect(await notificationsFor(testApp, adminOfA)).toEqual([]);
      expect(await audienceDeliveries(testApp, audience)).toEqual({
        owner: [],
        actor: [],
        admin: [],
        viewer: [],
      });
      expect(await deliveriesFor(testApp, organizationAdmin)).toEqual([]);
    });

    it("tells the admins of every experiment when no caller asks for one to be left out", async () => {
      await drift("v2");

      assertSuccess(await useCase.execute(workbookId, audience.actor));

      expect(await notificationsFor(testApp, adminOfA)).toEqual([
        expect.objectContaining({ resourceId: experimentA }),
      ]);
      expect(
        (await notificationsFor(testApp, audience.owner)).map((row) => row.resourceId),
      ).toEqual(expect.arrayContaining([experimentA, experimentB]));
    });

    it("tells an admin again only once they have read the first one", async () => {
      await drift("v2");
      assertSuccess(
        await useCase.execute(workbookId, audience.actor, { forExperimentId: experimentA }),
      );
      await drift("v3");
      assertSuccess(
        await useCase.execute(workbookId, audience.actor, { forExperimentId: experimentA }),
      );

      expect(await notificationsFor(testApp, audience.admin)).toEqual([
        heardAbout(audience.admin, "2"),
      ]);

      assertSuccess(await testApp.module.get(NotificationRepository).markAllRead(audience.admin));
      await drift("v4");
      assertSuccess(
        await useCase.execute(workbookId, audience.actor, { forExperimentId: experimentA }),
      );

      expect(await notificationsFor(testApp, audience.admin)).toEqual([
        heardAbout(audience.admin, "2"),
        heardAbout(audience.admin, "4"),
      ]);
    });

    it("tells nobody about an archived experiment", async () => {
      await testApp.database
        .update(experiments)
        .set({ status: "archived" })
        .where(eq(experiments.id, experimentB));
      await drift("v2");

      assertSuccess(
        await useCase.execute(workbookId, audience.actor, { forExperimentId: experimentA }),
      );

      expect(await audienceNotifications(testApp, audience)).toEqual({
        owner: [],
        actor: [],
        admin: [],
        viewer: [],
      });
      expect(await notificationsFor(testApp, adminOfA)).toEqual([]);
    });

    it("dispatches nothing for a workbook only the saving experiment uses", async () => {
      await testApp.database
        .update(experiments)
        .set({ workbookId: null, workbookVersionId: null })
        .where(eq(experiments.id, experimentB));
      const dispatch = vi.spyOn(testApp.module.get(NotificationDispatchService), "dispatch");
      await drift("v2");

      assertSuccess(
        await useCase.execute(workbookId, audience.actor, { forExperimentId: experimentA }),
      );

      expect(dispatch).not.toHaveBeenCalled();
    });

    it("dispatches nothing for a workbook no experiment uses yet", async () => {
      const dispatch = vi.spyOn(testApp.module.get(NotificationDispatchService), "dispatch");
      const fresh = await testApp.createWorkbook({ name: "Fresh", createdBy: audience.actor });

      assertSuccess(await useCase.execute(fresh.id, audience.actor));

      expect(dispatch).not.toHaveBeenCalled();
    });

    it("still returns the version and logs when the admins cannot be looked up", async () => {
      vi.spyOn(testApp.module.get(SharingRepository), "listAdminIds").mockResolvedValue(
        failure(AppError.internal("Database unavailable")),
      );
      const error = vi.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
      await drift("v2");

      const result = await useCase.execute(workbookId, audience.actor, {
        forExperimentId: experimentA,
      });

      assertSuccess(result);
      expect(result.value.version).toBe(2);
      expect(await audienceNotifications(testApp, audience)).toEqual({
        owner: [],
        actor: [],
        admin: [],
        viewer: [],
      });
      expect(error).toHaveBeenCalledWith(
        expect.objectContaining({ operation: "publishVersion", experimentId: experimentB }),
      );
    });
  });
});
