import { StatusCodes } from "http-status-codes";

import { eq, macros, organizations, organizationMembers } from "@repo/database";

import { assertFailure, assertSuccess } from "../../common/utils/fp-utils";
import { TestHarness } from "../../test/test-harness";
import { CreateGrantUseCase } from "./create-grant";
import { ListGrantsUseCase } from "./list-grants";

describe("listGrants", () => {
  const testApp = TestHarness.App;
  let listGrants: ListGrantsUseCase;
  let createGrant: CreateGrantUseCase;
  let owner: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    listGrants = testApp.module.get(ListGrantsUseCase);
    createGrant = testApp.module.get(CreateGrantUseCase);
    owner = await testApp.createTestUser({ name: "Owner" });
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  async function makeSharedOrg() {
    const [org] = await testApp.database
      .insert(organizations)
      .values({ name: `Org ${crypto.randomUUID()}`, slug: `org-${crypto.randomUUID()}` })
      .returning();
    return org.id;
  }

  it("allows the owning-org owner and returns the direct grants", async () => {
    const macro = await testApp.createMacro({ name: "M", createdBy: owner });
    const outsider = await testApp.createTestUser({ name: "Outsider" });
    assertSuccess(
      await createGrant.execute(owner, "macro", macro.id, {
        granteeType: "user",
        granteeId: outsider,
        role: "viewer",
      }),
    );

    const result = await listGrants.execute(owner, "macro", macro.id);
    assertSuccess(result);
    expect(result.value).toHaveLength(1);
    expect(result.value[0].granteeId).toBe(outsider);
  });

  it("denies a viewer-grant holder (no collaborator enumeration)", async () => {
    const macro = await testApp.createMacro({ name: "M", createdBy: owner });
    const viewer = await testApp.createTestUser({ name: "Viewer" });
    await testApp.addResourceGrant({
      resourceType: "macro",
      resourceId: macro.id,
      granteeType: "user",
      granteeId: viewer,
      role: "viewer",
    });

    const result = await listGrants.execute(viewer, "macro", macro.id);
    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.FORBIDDEN);
  });

  it("denies a plain public-read viewer (public resource, no grant)", async () => {
    const macro = await testApp.createMacro({ name: "M", createdBy: owner }); // public by default
    const reader = await testApp.createTestUser({ name: "Reader" });

    const result = await listGrants.execute(reader, "macro", macro.id);
    assertFailure(result);
    expect(result.error.statusCode).toBe(StatusCodes.FORBIDDEN);
  });

  it("marks a user grantee in the owning org as not an outside collaborator", async () => {
    const orgId = await makeSharedOrg();
    await testApp.database
      .insert(organizationMembers)
      .values({ organizationId: orgId, userId: owner, role: "owner" });
    const member = await testApp.createTestUser({ name: "Member" });
    await testApp.database
      .insert(organizationMembers)
      .values({ organizationId: orgId, userId: member, role: "member" });
    // Macro owned by the shared org.
    const macro = await testApp.createMacro({ name: "M", createdBy: owner });
    await testApp.database
      .update(macros)
      .set({ organizationId: orgId })
      .where(eq(macros.id, macro.id));

    assertSuccess(
      await createGrant.execute(owner, "macro", macro.id, {
        granteeType: "user",
        granteeId: member,
        role: "viewer",
      }),
    );
    const result = await listGrants.execute(owner, "macro", macro.id);
    assertSuccess(result);
    const grant = result.value.find((g) => g.granteeId === member);
    expect(grant?.isOutsideCollaborator).toBe(false);
  });

  it("marks an organization grantee other than the owning org as an outside collaborator", async () => {
    const macro = await testApp.createMacro({ name: "M", createdBy: owner });
    // A shared org the sharer belongs to (grantees must be selectable in the
    // picker) but which does NOT own the macro — the outside-collaborator case.
    const otherOrg = await makeSharedOrg();
    await testApp.database
      .insert(organizationMembers)
      .values({ organizationId: otherOrg, userId: owner, role: "member" });

    assertSuccess(
      await createGrant.execute(owner, "macro", macro.id, {
        granteeType: "organization",
        granteeId: otherOrg,
        role: "viewer",
      }),
    );
    const result = await listGrants.execute(owner, "macro", macro.id);
    assertSuccess(result);
    const grant = result.value.find((g) => g.granteeId === otherOrg);
    expect(grant?.granteeType).toBe("organization");
    expect(grant?.isOutsideCollaborator).toBe(true);
  });
});
