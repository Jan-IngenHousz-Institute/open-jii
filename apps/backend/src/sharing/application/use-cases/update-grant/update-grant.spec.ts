import { StatusCodes } from "http-status-codes";

import { eq, notifications, resourceGrants } from "@repo/database";

import { EmailAdapter } from "../../../../common/modules/email/services/email.adapter";
import {
  AppError,
  assertFailure,
  assertSuccess,
  failure,
  success,
} from "../../../../common/utils/fp-utils";
import { NotificationDispatchService } from "../../../../notifications/application/services/notification-dispatch.service";
import { queuedDeliveriesFor } from "../../../../test/notification-deliveries";
import { TestHarness } from "../../../../test/test-harness";
import { SharingRepository } from "../../../core/repositories/sharing.repository";
import { UpdateGrantUseCase } from "./update-grant";

describe("updateGrant", () => {
  const testApp = TestHarness.App;
  let updateGrant: UpdateGrantUseCase;
  let sharingRepo: SharingRepository;
  let emailAdapter: EmailAdapter;
  let owner: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    updateGrant = testApp.module.get(UpdateGrantUseCase);
    sharingRepo = testApp.module.get(SharingRepository);
    emailAdapter = testApp.module.get(EmailAdapter);
    owner = await testApp.createTestUser({ name: "Owner" });
    vi.spyOn(emailAdapter, "sendAccessGrantedNotification").mockResolvedValue(success(undefined));
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("returns 404 for a grant id belonging to a different resource", async () => {
    const { experiment } = await testApp.createExperiment({
      name: `Exp ${crypto.randomUUID()}`,
      userId: owner,
    });
    const other = await testApp.createExperiment({
      name: `Other ${crypto.randomUUID()}`,
      userId: owner,
    });
    const collaborator = await testApp.createTestUser({ name: "Collaborator" });
    // The grant lives on `other`, and the caller administers both — so only the
    // resource scoping in the update itself stops this editing the wrong row.
    const elsewhere = await testApp.addResourceGrant({
      resourceType: "experiment",
      resourceId: other.experiment.id,
      granteeType: "user",
      granteeId: collaborator,
      role: "viewer",
      createdBy: owner,
    });

    const updated = await updateGrant.execute(owner, "experiment", experiment.id, elsewhere.id, {
      role: "admin",
    });
    assertFailure(updated);
    expect(updated.error.statusCode).toBe(StatusCodes.NOT_FOUND);

    const [untouched] = await testApp.database
      .select()
      .from(resourceGrants)
      .where(eq(resourceGrants.id, elsewhere.id));
    expect(untouched.role).toBe("viewer");
  });

  // A level change is something the collaborator hears about in the bell. It sends
  // no email: the category's email is reserved for being given access in the first
  // place.
  describe("notifying the grantee", () => {
    const deliveriesFor = (userId: string) => queuedDeliveriesFor(testApp.database, userId);

    const notificationsFor = (userId: string) =>
      testApp.database.select().from(notifications).where(eq(notifications.recipientId, userId));

    it("tells the grantee their level changed, with the new role", async () => {
      const name = `Macro ${crypto.randomUUID()}`;
      const macro = await testApp.createMacro({ name, createdBy: owner });
      const collaborator = await testApp.createTestUser({ name: "Lifted Collaborator" });
      const grant = await testApp.addResourceGrant({
        resourceType: "macro",
        resourceId: macro.id,
        granteeType: "user",
        granteeId: collaborator,
        role: "viewer",
        createdBy: owner,
      });

      assertSuccess(
        await updateGrant.execute(owner, "macro", macro.id, grant.id, { role: "admin" }),
      );

      const rows = await notificationsFor(collaborator);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        type: "resource_access_changed",
        actorId: owner,
        resourceType: "macro",
        resourceId: macro.id,
        params: { resourceName: name, role: "admin" },
      });
      // A level change owes no email, so there is nothing for the worker to pick up.
      expect(await deliveriesFor(collaborator)).toEqual([]);
    });

    it("says nothing when the role is set to what it already was", async () => {
      const macro = await testApp.createMacro({ name: "Unmoved", createdBy: owner });
      const collaborator = await testApp.createTestUser({ name: "Unmoved Collaborator" });
      const grant = await testApp.addResourceGrant({
        resourceType: "macro",
        resourceId: macro.id,
        granteeType: "user",
        granteeId: collaborator,
        role: "viewer",
        createdBy: owner,
      });

      assertSuccess(
        await updateGrant.execute(owner, "macro", macro.id, grant.id, { role: "viewer" }),
      );

      expect(await notificationsFor(collaborator)).toEqual([]);
      expect(await deliveriesFor(collaborator)).toEqual([]);
    });

    // Both ways the telling can fail leave the role change itself standing.
    it("still changes the role when the resource name cannot be read", async () => {
      const macro = await testApp.createMacro({ name: "Unnameable", createdBy: owner });
      const collaborator = await testApp.createTestUser({ name: "Unnamed Collaborator" });
      const grant = await testApp.addResourceGrant({
        resourceType: "macro",
        resourceId: macro.id,
        granteeType: "user",
        granteeId: collaborator,
        role: "viewer",
        createdBy: owner,
      });
      vi.spyOn(sharingRepo, "findResourceName").mockResolvedValue(
        failure(AppError.internal("name lookup unavailable")),
      );

      assertSuccess(
        await updateGrant.execute(owner, "macro", macro.id, grant.id, { role: "admin" }),
      );

      const [stored] = await testApp.database
        .select()
        .from(resourceGrants)
        .where(eq(resourceGrants.id, grant.id));
      expect(stored.role).toBe("admin");
      expect(await notificationsFor(collaborator)).toEqual([]);
    });

    it("still changes the role when the notification cannot be dispatched", async () => {
      const macro = await testApp.createMacro({ name: "Dispatch Down", createdBy: owner });
      const collaborator = await testApp.createTestUser({ name: "Unreachable Collaborator" });
      const grant = await testApp.addResourceGrant({
        resourceType: "macro",
        resourceId: macro.id,
        granteeType: "user",
        granteeId: collaborator,
        role: "viewer",
        createdBy: owner,
      });
      vi.spyOn(testApp.module.get(NotificationDispatchService), "dispatch").mockResolvedValue(
        failure(AppError.internal("notifications unavailable")),
      );

      const result = await updateGrant.execute(owner, "macro", macro.id, grant.id, {
        role: "admin",
      });

      assertSuccess(result);
      const [stored] = await testApp.database
        .select()
        .from(resourceGrants)
        .where(eq(resourceGrants.id, grant.id));
      expect(stored.role).toBe("admin");
      expect(await notificationsFor(collaborator)).toEqual([]);
    });
  });

  // An archived experiment is immutable everywhere else — the read-only row controls
  // are not the enforcement, the server is.
  it("refuses a role change on an archived experiment, leaving the grant alone", async () => {
    const { experiment } = await testApp.createExperiment({
      name: `Exp ${crypto.randomUUID()}`,
      userId: owner,
      status: "archived",
    });
    const collaborator = await testApp.createTestUser({ name: "Collaborator" });
    const grant = await testApp.addResourceGrant({
      resourceType: "experiment",
      resourceId: experiment.id,
      granteeType: "user",
      granteeId: collaborator,
      role: "viewer",
      createdBy: owner,
    });

    const updated = await updateGrant.execute(owner, "experiment", experiment.id, grant.id, {
      role: "admin",
    });

    assertFailure(updated);
    expect(updated.error.statusCode).toBe(StatusCodes.FORBIDDEN);
    expect(updated.error.message).toBe("Cannot modify an archived experiment");
    const [unchanged] = await testApp.database
      .select()
      .from(resourceGrants)
      .where(eq(resourceGrants.id, grant.id));
    expect(unchanged.role).toBe("viewer");
  });
});
