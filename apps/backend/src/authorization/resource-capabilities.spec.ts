import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";
import type { ResourceCapabilities } from "@repo/api/domains/authorization/capabilities.schema";

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

      // canLeave is false: the creator's control comes from their personal-org
      // owner role, not a grant row — there is nothing of their own to give up.
      expect(await capabilitiesFor(path, owner)).toEqual({
        canContribute: true,
        canUpdate: true,
        canManage: true,
        canShare: true,
        canLeave: false,
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
      expect(await capabilitiesFor(path, collaborator)).toEqual({
        canContribute: true,
        canUpdate: true,
        canManage: true,
        canShare: true,
        canLeave: true,
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
      });
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
