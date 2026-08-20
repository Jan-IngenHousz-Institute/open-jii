import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import type { ResourceCapabilities } from "@repo/api/domains/authorization/capabilities.schema";
import { eq, profiles } from "@repo/database";

import { TestHarness } from "../test/test-harness";

/**
 * The capability signal on the macro/protocol/workbook detail responses.
 *
 * These run against the real `can()` and real grant rows, because the point of
 * the signal is that the web app stops guessing from `createdBy`: a grantee with
 * an `admin` share must come back `canUpdate: true` even though they created
 * nothing, and a `viewer` must not.
 *
 * `canContribute` is present on these responses but answers false for a read-tier
 * grantee: there is no "add data to a macro" surface, so the read tier does not
 * promise one. Full-control roles hold every verb and so answer true. What matters
 * on these types is `canUpdate`.
 */
describe("resource capabilities on detail responses", () => {
  const testApp = TestHarness.App;
  let owner: string;

  beforeAll(async () => {
    await testApp.setup({ mock: { AnalyticsAdapter: true } });
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    owner = await testApp.createTestUser({ name: "Owner" });
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  async function capabilitiesFor(
    path: string,
    userId: string,
  ): Promise<ResourceCapabilities & Record<string, unknown>> {
    const res = await testApp.get(path).withAuth(userId).expect(StatusCodes.OK);
    const body = res.body as { capabilities: ResourceCapabilities };
    return body.capabilities;
  }

  describe("macro", () => {
    it("gives the owning-org owner every capability", async () => {
      const macro = await testApp.createMacro({ name: "M", createdBy: owner });
      const path = testApp.resolveOrpcPath(contract.macros.getMacro, { id: macro.id });

      // canLeave is false, and falls out rather than being special-cased: it asks
      // whether the caller holds a direct grant to give up, and an owner holds none
      // — their control comes from the owning org. Owners cannot leave their own
      // resources, which is why the surface offers them no such affordance.
      expect(await capabilitiesFor(path, owner)).toEqual({
        canContribute: true,
        canUpdate: true,
        canManage: true,
        canShare: true,
        canLeave: false,
        canTransfer: true,
      });
    });

    it("lets an admin grantee edit a macro they did not create", async () => {
      const macro = await testApp.createMacro({ name: "M", createdBy: owner });
      const collaborator = await testApp.createTestUser({ name: "Collaborator" });
      await testApp.addResourceGrant({
        resourceType: "macro",
        resourceId: macro.id,
        granteeType: "user",
        granteeId: collaborator,
        role: "admin",
      });

      const path = testApp.resolveOrpcPath(contract.macros.getMacro, { id: macro.id });
      // "Can edit" in the collaborators picker must actually mean editable here.
      // Not transferable, though: the owning organization still has a living
      // owner, and a grantee moving the macro elsewhere would be taking it.
      expect(await capabilitiesFor(path, collaborator)).toEqual({
        canContribute: true,
        canUpdate: true,
        canManage: true,
        canShare: true,
        canLeave: true,
        canTransfer: false,
      });
    });

    it("keeps a viewer grantee out of editing, managing and sharing", async () => {
      const macro = await testApp.createMacro({ name: "M", createdBy: owner });
      const viewer = await testApp.createTestUser({ name: "Viewer" });
      await testApp.addResourceGrant({
        resourceType: "macro",
        resourceId: macro.id,
        granteeType: "user",
        granteeId: viewer,
        role: "viewer",
      });

      const path = testApp.resolveOrpcPath(contract.macros.getMacro, { id: macro.id });
      // canLeave is the one capability a read-tier grantee does hold: their
      // grant row is theirs to give up.
      expect(await capabilitiesFor(path, viewer)).toEqual({
        canContribute: false,
        canUpdate: false,
        canManage: false,
        canShare: false,
        canLeave: true,
        canTransfer: false,
      });
    });

    it("gives a plain public reader nothing beyond read", async () => {
      const macro = await testApp.createMacro({ name: "M", createdBy: owner }); // public
      const stranger = await testApp.createTestUser({ name: "Stranger" });

      const path = testApp.resolveOrpcPath(contract.macros.getMacro, { id: macro.id });
      expect(await capabilitiesFor(path, stranger)).toEqual({
        canContribute: false,
        canUpdate: false,
        canManage: false,
        canShare: false,
        canLeave: false,
        canTransfer: false,
      });
    });

    it("offers the transfer to a grantee once the owning organization is a husk", async () => {
      const organizationId = await testApp.createOrganization();
      await testApp.addOrganizationMember(organizationId, owner, "owner");
      const macro = await testApp.createMacro({ name: "M", createdBy: owner, organizationId });
      const collaborator = await testApp.createTestUser({ name: "Collaborator" });
      await testApp.addResourceGrant({
        resourceType: "macro",
        resourceId: macro.id,
        granteeType: "user",
        granteeId: collaborator,
        role: "admin",
      });

      const path = testApp.resolveOrpcPath(contract.macros.getMacro, { id: macro.id });
      expect(await capabilitiesFor(path, collaborator)).toMatchObject({ canTransfer: false });

      // An admin joins, then the only owner closes their account. Losing an owner
      // does not abandon an organization — somebody inside can still act, so the
      // macro is not the collaborator's to move.
      const admin = await testApp.createTestUser({ name: "Admin" });
      await testApp.addOrganizationMember(organizationId, admin, "admin");
      await testApp.database
        .update(profiles)
        .set({ deletedAt: new Date() })
        .where(eq(profiles.userId, owner));

      expect(await capabilitiesFor(path, collaborator)).toMatchObject({ canTransfer: false });

      // Now the admin goes too: nobody is left to move the macro out, and it
      // cannot stay where it is either — the organization can never be deleted
      // while it owns something.
      await testApp.database
        .update(profiles)
        .set({ deletedAt: new Date() })
        .where(eq(profiles.userId, admin));

      expect(await capabilitiesFor(path, collaborator)).toMatchObject({ canTransfer: true });
    });
  });

  describe("protocol", () => {
    it("lets an admin grantee edit, and keeps a viewer read-only", async () => {
      const protocol = await testApp.createProtocol({ name: "P", createdBy: owner });
      const collaborator = await testApp.createTestUser({ name: "Collaborator" });
      const viewer = await testApp.createTestUser({ name: "Viewer" });
      await testApp.addResourceGrant({
        resourceType: "protocol",
        resourceId: protocol.id,
        granteeType: "user",
        granteeId: collaborator,
        role: "admin",
      });
      await testApp.addResourceGrant({
        resourceType: "protocol",
        resourceId: protocol.id,
        granteeType: "user",
        granteeId: viewer,
        role: "viewer",
      });

      const path = testApp.resolveOrpcPath(contract.protocols.getProtocol, { id: protocol.id });
      expect(await capabilitiesFor(path, collaborator)).toMatchObject({ canUpdate: true });
      expect(await capabilitiesFor(path, viewer)).toMatchObject({ canUpdate: false });
    });
  });

  describe("workbook", () => {
    it("lets an admin grantee edit, and keeps a viewer read-only", async () => {
      const workbook = await testApp.createWorkbook({ name: "W", createdBy: owner });
      const collaborator = await testApp.createTestUser({ name: "Collaborator" });
      const viewer = await testApp.createTestUser({ name: "Viewer" });
      await testApp.addResourceGrant({
        resourceType: "workbook",
        resourceId: workbook.id,
        granteeType: "user",
        granteeId: collaborator,
        role: "admin",
      });
      await testApp.addResourceGrant({
        resourceType: "workbook",
        resourceId: workbook.id,
        granteeType: "user",
        granteeId: viewer,
        role: "viewer",
      });

      const path = testApp.resolveOrpcPath(contract.workbooks.getWorkbook, { id: workbook.id });
      expect(await capabilitiesFor(path, collaborator)).toMatchObject({ canUpdate: true });
      expect(await capabilitiesFor(path, viewer)).toMatchObject({ canUpdate: false });
    });

    it("reflects a revoked grant on the next fetch", async () => {
      const workbook = await testApp.createWorkbook({ name: "W", createdBy: owner });
      const collaborator = await testApp.createTestUser({ name: "Collaborator" });
      const grant = await testApp.addResourceGrant({
        resourceType: "workbook",
        resourceId: workbook.id,
        granteeType: "user",
        granteeId: collaborator,
        role: "admin",
      });

      const path = testApp.resolveOrpcPath(contract.workbooks.getWorkbook, { id: workbook.id });
      expect(await capabilitiesFor(path, collaborator)).toMatchObject({ canUpdate: true });

      await testApp.removeResourceGrant(grant.id);

      // Public-read survives the revoke, so the detail route still answers 200 —
      // but the edit capability is gone.
      expect(await capabilitiesFor(path, collaborator)).toMatchObject({
        canUpdate: false,
        canManage: false,
        canShare: false,
      });
    });
  });
});
