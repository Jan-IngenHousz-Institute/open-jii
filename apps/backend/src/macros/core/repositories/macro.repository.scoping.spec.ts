import { StatusCodes } from "http-status-codes";

import { contract } from "@repo/api/contract";

import { assertSuccess } from "../../../common/utils/fp-utils";
import { TestHarness } from "../../../test/test-harness";
import type { SuperTestResponse } from "../../../test/test-harness";
import { MacroRepository } from "./macro.repository";

/**
 * Access scoping for macro listing: a private macro is only visible to owning-org
 * members and grantees; public macros are visible to everyone. Mirrors the experiment `findAll` scoping. Grant tiers are asserted
 * with hand-inserted grants (the sharing write-path is exercised elsewhere).
 */
describe("MacroRepository — list access scoping", () => {
  const testApp = TestHarness.App;
  let repository: MacroRepository;
  let owner: string;
  let orgId: string;
  let privateMacroId: string;
  let publicMacroId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    repository = testApp.module.get(MacroRepository);

    owner = await testApp.createTestUser({ name: "Macro Owner" });
    orgId = await testApp.createOrganization();
    await testApp.addOrganizationMember(orgId, owner, "owner");

    const priv = await testApp.createMacro({
      name: "Private macro",
      createdBy: owner,
      visibility: "private",
      organizationId: orgId,
    });
    privateMacroId = priv.id;

    const pub = await testApp.createMacro({
      name: "Public macro",
      createdBy: owner,
      visibility: "public",
      organizationId: orgId,
    });
    publicMacroId = pub.id;
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const listIdsFor = async (userId: string | undefined) => {
    const result = await repository.findAll({ userId });
    assertSuccess(result);
    return result.value.map((m) => m.id);
  };

  it("hides a private macro from a stranger but shows the public one", async () => {
    const stranger = await testApp.createTestUser({ name: "Stranger" });

    const ids = await listIdsFor(stranger);

    expect(ids).toContain(publicMacroId);
    expect(ids).not.toContain(privateMacroId);
  });

  it("shows a private macro to a member of the owning organization", async () => {
    const orgMember = await testApp.createTestUser({ name: "Org Member" });
    await testApp.addOrganizationMember(orgId, orgMember, "member");

    const ids = await listIdsFor(orgMember);

    expect(ids).toContain(privateMacroId);
    expect(ids).toContain(publicMacroId);
  });

  it("shows a private macro to a direct user grantee", async () => {
    const grantee = await testApp.createTestUser({ name: "User Grantee" });
    await testApp.addResourceGrant({
      resourceType: "macro",
      resourceId: privateMacroId,
      granteeType: "user",
      granteeId: grantee,
      role: "viewer",
    });

    const ids = await listIdsFor(grantee);

    expect(ids).toContain(privateMacroId);
  });

  it("shows a private macro to a member of a grantee organization", async () => {
    const orgGrantee = await testApp.createTestUser({ name: "Org Grantee" });
    const granteeOrgId = await testApp.createOrganization();
    await testApp.addOrganizationMember(granteeOrgId, orgGrantee, "member");
    await testApp.addResourceGrant({
      resourceType: "macro",
      resourceId: privateMacroId,
      granteeType: "organization",
      granteeId: granteeOrgId,
      role: "viewer",
    });

    const ids = await listIdsFor(orgGrantee);

    expect(ids).toContain(privateMacroId);
  });

  it("shows the owner both macros", async () => {
    const ids = await listIdsFor(owner);

    expect(ids).toContain(privateMacroId);
    expect(ids).toContain(publicMacroId);
  });

  it("shows only public macros when there is no caller", async () => {
    const ids = await listIdsFor(undefined);

    expect(ids).toContain(publicMacroId);
    expect(ids).not.toContain(privateMacroId);
  });

  it("denies executing a private macro to a stranger (read guard)", async () => {
    // executeMacro is gated on `read`: a stranger who knows the private
    // macro's UUID must not be able to run its code.
    const stranger = await testApp.createTestUser({ name: "Stranger" });

    await testApp
      .post(testApp.resolveOrpcPath(contract.macros.executeMacro, { id: privateMacroId }))
      .withAuth(stranger)
      .send({ data: { x: 1 } })
      .expect(StatusCodes.FORBIDDEN);
  });

  it('keeps the "my" filter as an ownership view, unaffected by visibility', async () => {
    const other = await testApp.createTestUser({ name: "Other Author" });
    const othersMacro = await testApp.createMacro({
      name: "Someone else's macro",
      createdBy: other,
      visibility: "public",
    });

    const result = await repository.findAll({ filter: "my", userId: owner });
    assertSuccess(result);
    const ids = result.value.map((m) => m.id);

    // Owner authored both (private + public); neither hidden, and another
    // author's macro is excluded.
    expect(ids).toEqual(expect.arrayContaining([privateMacroId, publicMacroId]));
    expect(ids).not.toContain(othersMacro.id);
  });
});

/**
 * Private-at-create round-trip: the create route accepts an optional visibility
 * (default public) and persists it; the update body never carries visibility.
 */
describe("MacroController — create with visibility", () => {
  const testApp = TestHarness.App;
  let testUserId: string;

  beforeAll(async () => {
    await testApp.setup();
  });

  beforeEach(async () => {
    await testApp.beforeEach();
    testUserId = await testApp.createTestUser({ name: "Creator" });
  });

  afterEach(() => {
    testApp.afterEach();
  });

  afterAll(async () => {
    await testApp.teardown();
  });

  const createPath = () => testApp.resolveOrpcPath(contract.macros.createMacro);

  it("persists visibility=private when requested", async () => {
    const response: SuperTestResponse<{ id: string; visibility: string }> = await testApp
      .post(createPath())
      .withAuth(testUserId)
      .send({
        name: "Private at create",
        language: "python",
        code: "cHJpbnQoJ2hpJyk=",
        visibility: "private",
      })
      .expect(StatusCodes.CREATED);

    expect(response.body.visibility).toBe("private");
  });

  it("defaults to public when visibility is omitted", async () => {
    const response: SuperTestResponse<{ id: string; visibility: string }> = await testApp
      .post(createPath())
      .withAuth(testUserId)
      .send({
        name: "Default visibility",
        language: "python",
        code: "cHJpbnQoJ2hpJyk=",
      })
      .expect(StatusCodes.CREATED);

    expect(response.body.visibility).toBe("public");
  });
});
