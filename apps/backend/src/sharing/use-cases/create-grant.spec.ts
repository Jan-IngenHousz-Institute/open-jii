import { StatusCodes } from "http-status-codes";

import { assertFailure, assertSuccess } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";
import { CreateGrantUseCase } from "./create-grant";

describe("createGrant", () => {
  const testApp = TestHarness.App;
  let createGrant: CreateGrantUseCase;
  let owner: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    createGrant = testApp.module.get(CreateGrantUseCase);
    owner = await testApp.createTestUser({ name: "Owner" });
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  it("returns 400 when the grantee does not exist", async () => {
    const macro = await testApp.createMacro({ name: "M", createdBy: owner });
    const result = await createGrant.execute(owner, "macro", macro.id, {
      granteeType: "user",
      granteeId: crypto.randomUUID(),
      role: "viewer",
    });
    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.BAD_REQUEST);
  });

  it("re-sharing an existing grantee updates the role (upsert, single direct row)", async () => {
    const macro = await testApp.createMacro({ name: "M", createdBy: owner });
    const outsider = await testApp.createTestUser({ name: "Outsider" });

    assertSuccess(
      await createGrant.execute(owner, "macro", macro.id, {
        granteeType: "user",
        granteeId: outsider,
        role: "viewer",
      }),
    );
    const second = await createGrant.execute(owner, "macro", macro.id, {
      granteeType: "user",
      granteeId: outsider,
      role: "admin",
    });
    assertSuccess(second);
    expect(second.value).toHaveLength(1);
    expect(second.value[0].role).toBe("admin");
    expect(second.value[0].isOutsideCollaborator).toBe(true);
  });

  // Grantees are validated against the same visibility rules the grantee
  // pickers use — existence alone is not enough, because the collaborators list
  // would then disclose that grantee's details back to the sharer.
  describe("grantee selectability", () => {
    it("rejects a deactivated user (not discoverable in the people picker)", async () => {
      const macro = await testApp.createMacro({ name: "M", createdBy: owner });
      const deactivated = await testApp.createTestUser({ name: "Gone User", activated: false });

      const result = await createGrant.execute(owner, "macro", macro.id, {
        granteeType: "user",
        granteeId: deactivated,
        role: "viewer",
      });
      assertFailure(result);
      expect(result.error.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it("rejects a soft-deleted user", async () => {
      const macro = await testApp.createMacro({ name: "M", createdBy: owner });
      const deleted = await testApp.createTestUser({ name: "Deleted User", deletedAt: new Date() });

      const result = await createGrant.execute(owner, "macro", macro.id, {
        granteeType: "user",
        granteeId: deleted,
        role: "viewer",
      });
      assertFailure(result);
      expect(result.error.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it("rejects an organization the sharer is not a member of", async () => {
      const macro = await testApp.createMacro({ name: "M", createdBy: owner });
      const strangerOrg = await testApp.createOrganization("Someone Else Lab");

      const result = await createGrant.execute(owner, "macro", macro.id, {
        granteeType: "organization",
        granteeId: strangerOrg,
        role: "viewer",
      });
      assertFailure(result);
      expect(result.error.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it("rejects a personal workspace as an organization grantee", async () => {
      const macro = await testApp.createMacro({ name: "M", createdBy: owner });
      // The owner's own personal org: they are a member, but personal
      // workspaces are excluded from the picker.
      const personalOrgId = await testApp.personalOrganizationId(owner);

      const result = await createGrant.execute(owner, "macro", macro.id, {
        granteeType: "organization",
        granteeId: personalOrgId,
        role: "viewer",
      });
      assertFailure(result);
      expect(result.error.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it("accepts an organization the sharer belongs to", async () => {
      const macro = await testApp.createMacro({ name: "M", createdBy: owner });
      const orgId = await testApp.createOrganization("Greenhouse Lab");
      await testApp.addOrganizationMember(orgId, owner, "member");

      const result = await createGrant.execute(owner, "macro", macro.id, {
        granteeType: "organization",
        granteeId: orgId,
        role: "viewer",
      });
      assertSuccess(result);
      expect(result.value.map((g) => g.granteeId)).toContain(orgId);
    });
  });

  it("denies a viewer-grant holder from sharing", async () => {
    const macro = await testApp.createMacro({ name: "M", createdBy: owner });
    const viewer = await testApp.createTestUser({ name: "Viewer" });
    await testApp.addResourceGrant({
      resourceType: "macro",
      resourceId: macro.id,
      granteeType: "user",
      granteeId: viewer,
      role: "viewer",
    });
    const other = await testApp.createTestUser({ name: "Other" });

    const result = await createGrant.execute(viewer, "macro", macro.id, {
      granteeType: "user",
      granteeId: other,
      role: "viewer",
    });
    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.FORBIDDEN);
  });
});
